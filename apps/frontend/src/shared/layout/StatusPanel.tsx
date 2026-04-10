interface StatusPanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const StatusPanel = ({ title, message, actionLabel, onAction }: StatusPanelProps) => {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-10">
      <div className="terminal-panel max-w-2xl w-full p-10 text-left">
        <p className="terminal-label">SYSTEM STATE</p>
        <div className="mt-4 space-y-3">
          <h1 className="text-3xl uppercase tracking-[0.08em] text-foreground">{title}</h1>
          <p className="max-w-xl text-sm uppercase tracking-[0.06em] text-muted-foreground">{message}</p>
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="terminal-button-inverse mt-8"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;
