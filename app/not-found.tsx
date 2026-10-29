import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-4">
      <div>
        <p className="t-display text-[clamp(6rem,20vw,14rem)] leading-none text-green">404</p>
        <h1 className="t-display t-h2 mt-4 max-w-[14ch]">This page skipped its check-in.</h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/apply" className="btn btn-green">Apply for coaching</Link>
          <Link href="/" className="btn btn-line">Go to the home page</Link>
        </div>
      </div>
    </main>
  );
}
