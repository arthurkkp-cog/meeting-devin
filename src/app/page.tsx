import UploadForm from "../components/UploadForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Meeting Ingestion
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload files, videos, or paste links — any combination of meeting
            context to process.
          </p>
        </header>
        <UploadForm />
      </div>
    </main>
  );
}
