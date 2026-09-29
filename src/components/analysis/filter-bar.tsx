"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";

type Filters = { from: string; to: string };

// Section/employee/estate-work are no longer a global filter here — each
// chart below picks those itself via its own dropdown(s), since different
// charts need different combinations (e.g. one work type across all
// sections, vs one section across all work types). The date range is the
// only thing that applies to every chart on the page.
export function FilterBar({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(initial);

  function apply() {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    router.push(`/analysis?${params.toString()}`);
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <Button size="sm" onClick={apply}>
          Apply filters
        </Button>
      </CardBody>
    </Card>
  );
}
