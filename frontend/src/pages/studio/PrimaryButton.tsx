interface PrimaryButtonProps {
  label: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
}

export default function PrimaryButton({
  label,
  onClick,
  type = 'button',
  disabled,
  loading,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full bg-prime-600 hover:bg-prime-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${
        isDisabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>...</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
