import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/states";

export default function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg">
      <ErrorState
        title="Page not found"
        description="That route does not exist in SiteSignal."
      />
      <div className="flex justify-center pb-6">
        <Button asChild variant="primary">
          <Link to="/">Back to overview</Link>
        </Button>
      </div>
    </Card>
  );
}
