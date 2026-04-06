interface StatusPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const StatusPanel = ({ title, message, actionLabel, onAction }: StatusPanelProps) => {
  return (
    <div className="min-h-[calc(100vh-2rem)] p-6 flex items-center justify-center">
      <div className="glass rounded-2xl p-8 max-w-xl w-full text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;
