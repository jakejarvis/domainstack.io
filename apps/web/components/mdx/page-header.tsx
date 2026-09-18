export function PageHeader({
  title,
  description,
  icon,
  badge,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="not-prose mt-1 mb-6 border-b border-border pb-6">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
        {icon}
        {title}
        {badge}
      </h1>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
