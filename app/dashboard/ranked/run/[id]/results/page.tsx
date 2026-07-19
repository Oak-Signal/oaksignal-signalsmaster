interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RankedResultsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">Ranked Run Results</h1>
      <p className="text-muted-foreground mt-2">Run ID: {id}</p>
    </div>
  );
}
