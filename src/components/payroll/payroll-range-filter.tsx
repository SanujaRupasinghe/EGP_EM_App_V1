"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";

export function PayrollRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [range, setRange] = useState({ from, to });

  function apply() {
    if (!range.from || !range.to) return;
    router.push(`/payroll?from=${range.from}&to=${range.to}`);
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="payroll-from">From</Label>
          <Input
            id="payroll-from"
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="payroll-to">To</Label>
          <Input
            id="payroll-to"
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <Button size="sm" onClick={apply}>
          Apply range
        </Button>
      </CardBody>
    </Card>
  );
}
