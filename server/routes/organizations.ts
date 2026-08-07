import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDatabase } from "../db/client";
import { organizations, organizationMembers, users } from "../db/schema";
import { HttpError } from "../http/validation";

export const organizationsRouter: Router = Router();

// ---------------------------------------------------------------------------
// Demo mode helpers — no auth middleware, so we find-or-create a default user
// ---------------------------------------------------------------------------

const DEMO_EMAIL = "demo@sitesignal.io";

/** Find or create the default demo user and return its id. */
async function getDemoUserId(): Promise<string> {
  const { db } = await getDatabase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = ${DEMO_EMAIL}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) return existing.id;

  const [created] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: "Demo User" })
    .returning({ id: users.id });

  if (!created) throw new HttpError(500, "Failed to create demo user");
  return created.id;
}

// Request schemas
const createOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
  description: z.string().max(500).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

// Helper: check if user is member of organization
async function isMember(userId: string, orgId: string, requiredRole?: string): Promise<boolean> {
  const { db } = await getDatabase();
  
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      sql`${organizationMembers.userId} = ${userId} AND ${organizationMembers.organizationId} = ${orgId}`
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!membership) return false;

  if (requiredRole) {
    const roleHierarchy = { admin: 3, member: 2, viewer: 1 };
    const userLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
    const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;
    return userLevel >= requiredLevel;
  }

  return true;
}

/**
 * POST /api/organizations
 * Create a new organization.
 */
organizationsRouter.post("/", async (req, res) => {
  const body = createOrganizationSchema.parse(req.body);
  const { db } = await getDatabase();

  // Check if slug is taken
  const existing = await db
    .select()
    .from(organizations)
    .where(sql`${organizations.slug} = ${body.slug}`)
    .limit(1);

  if (existing.length > 0) {
    throw new HttpError(409, "Organization slug already taken");
  }

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values(body)
    .returning();

  if (!org) {
    throw new HttpError(500, "Failed to create organization");
  }

  // Add creator as admin (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: demoUserId,
    role: "admin",
    joinedAt: new Date(),
  });

  res.status(201).json(org);
});

/**
 * GET /api/organizations
 * List organizations the user belongs to.
 */
organizationsRouter.get("/", async (_req, res) => {
  const { db } = await getDatabase();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      logoUrl: organizations.logoUrl,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      sql`${organizations.id} = ${organizationMembers.organizationId}`
    )
    .where(sql`${organizationMembers.userId} = ${await getDemoUserId()}`)
    .orderBy(organizations.name);

  res.json(orgs);
});

/**
 * GET /api/organizations/:id
 * Get organization details.
 */
organizationsRouter.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const { db } = await getDatabase();

  // Check membership (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  if (!(await isMember(demoUserId, id))) {
    throw new HttpError(403, "Not a member of this organization");
  }

  const org = await db
    .select()
    .from(organizations)
    .where(sql`${organizations.id} = ${id}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!org) {
    throw new HttpError(404, "Organization not found");
  }

  // Get members
  const members = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      email: users.email,
      name: users.name,
    })
    .from(organizationMembers)
    .innerJoin(users, sql`${organizationMembers.userId} = ${users.id}`)
    .where(sql`${organizationMembers.organizationId} = ${id}`)
    .orderBy(organizationMembers.createdAt);

  res.json({ ...org, members });
});

/**
 * PUT /api/organizations/:id
 * Update organization details.
 */
organizationsRouter.put("/:id", async (req, res) => {
  const id = req.params.id as string;
  const { db } = await getDatabase();

  // Check admin permission (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  if (!(await isMember(demoUserId, id, "admin"))) {
    throw new HttpError(403, "Admin permission required");
  }

  const body = createOrganizationSchema.partial().parse(req.body);

  const [updated] = await db
    .update(organizations)
    .set({ ...body, updatedAt: new Date() })
    .where(sql`${organizations.id} = ${id}`)
    .returning();

  if (!updated) {
    throw new HttpError(404, "Organization not found");
  }

  res.json(updated);
});

/**
 * DELETE /api/organizations/:id
 * Delete an organization.
 */
organizationsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  const { db } = await getDatabase();

  // Check admin permission (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  if (!(await isMember(demoUserId, id, "admin"))) {
    throw new HttpError(403, "Admin permission required");
  }

  await db.delete(organizations).where(sql`${organizations.id} = ${id}`);

  res.json({ message: "Organization deleted" });
});

/**
 * POST /api/organizations/:id/invite
 * Invite a member to the organization.
 */
organizationsRouter.post("/:id/invite", async (req, res) => {
  const id = req.params.id as string;
  const body = inviteMemberSchema.parse(req.body);
  const { db } = await getDatabase();

  // Check admin permission (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  if (!(await isMember(demoUserId, id, "admin"))) {
    throw new HttpError(403, "Admin permission required");
  }

  // Find user by email
  const invitee = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${body.email}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!invitee) {
    throw new HttpError(404, "User not found. They must sign up first.");
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(organizationMembers)
    .where(
      sql`${organizationMembers.organizationId} = ${id} AND ${organizationMembers.userId} = ${invitee.id}`
    )
    .limit(1);

  if (existing.length > 0) {
    throw new HttpError(409, "User is already a member");
  }

  // Add member
  await db.insert(organizationMembers).values({
    organizationId: id as string,
    userId: invitee.id,
    role: body.role,
    joinedAt: new Date(),
  });

  res.json({ message: "Member added successfully" });
});

/**
 * DELETE /api/organizations/:id/members/:memberId
 * Remove a member from the organization.
 */
organizationsRouter.delete("/:id/members/:memberId", async (req, res) => {
  const id = req.params.id as string;
  const memberId = req.params.memberId as string;
  const { db } = await getDatabase();

  // Check admin permission or self-removal (demo mode — always the demo user)
  const demoUserId = await getDemoUserId();
  const isAdminController = await isMember(demoUserId, id, "admin");
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(sql`${organizationMembers.id} = ${memberId}`)
    .limit(1)
    .then((rows) => rows[0]);

  if (!membership) {
    throw new HttpError(404, "Member not found");
  }

  if (!isAdminController && membership.userId !== demoUserId) {
    throw new HttpError(403, "Admin permission required");
  }

  // Prevent removing the last admin
  if (membership.role === "admin") {
    const adminCount = await db
      .select()
      .from(organizationMembers)
      .where(
        sql`${organizationMembers.organizationId} = ${id} AND ${organizationMembers.role} = 'admin'`
      );

    if (adminCount.length <= 1) {
      throw new HttpError(400, "Cannot remove the last admin");
    }
  }

  await db.delete(organizationMembers).where(sql`${organizationMembers.id} = ${memberId}`);

  res.json({ message: "Member removed" });
});
