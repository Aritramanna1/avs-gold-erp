export const ComingSoonPlaceholder = ({ moduleName }: { moduleName: string }) => (
  <div className="p-8 border-2 border-dashed border-gold/30 rounded-2xl text-center">
    <h2 className="text-2xl font-serif text-gold">{moduleName} Coming Soon</h2>
    <p className="text-muted-foreground">Development in progress.</p>
  </div>
);
