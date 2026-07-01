import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="institutional-page flex items-center justify-center px-6 py-12">
      <section className="admin-card w-full max-w-2xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-institutional-blue-light text-primary">
          <GraduationCap className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Sistema escolar
        </p>
        <h1 className="institutional-title text-3xl">CalifApp</h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-institutional-gray">
          Base frontend inicial lista para gestionar calificaciones,
          importaciones y boletines escolares.
        </p>
        <Button className="mt-8">
          Frontend inicializado
        </Button>
      </section>
    </main>
  );
}
