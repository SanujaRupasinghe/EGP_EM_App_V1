"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import type { Employee, Section, WorkType } from "@/lib/supabase/types";

type Filters = {
  from: string;
  to: string;
  section: string;
  employee: string;
  workType: string;
};

export function FilterBar({
  sections,
  employees,
  workTypes,
  initial,
}: {
  sections: Section[];
  employees: Employee[];
  workTypes: WorkType[];
  initial: Filters;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(initial);

  function apply() {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.section) params.set("section", filters.section);
    if (filters.employee) params.set("employee", filters.employee);
    if (filters.workType) params.set("workType", filters.workType);
    router.push(`/analysis?${params.toString()}`);
  }

  return (
    <Card>
      <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        <div>
          <Label htmlFor="filter-section">Section</Label>
          <Select
            id="filter-section"
            value={filters.section}
            onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}
          >
            <option value="">All</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-employee">Employee</Label>
          <Select
            id="filter-employee"
            value={filters.employee}
            onChange={(e) => setFilters((f) => ({ ...f, employee: e.target.value }))}
          >
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} — {e.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-work-type">Estate work</Label>
          <Select
            id="filter-work-type"
            value={filters.workType}
            onChange={(e) => setFilters((f) => ({ ...f, workType: e.target.value }))}
          >
            <option value="">All</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-5">
          <Button size="sm" onClick={apply}>
            Apply filters
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
