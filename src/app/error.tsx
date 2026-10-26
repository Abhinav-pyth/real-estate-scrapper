"use client";
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <button onClick={() => reset()} className="btn-primary">Try again</button>
    </div>
  );
}
