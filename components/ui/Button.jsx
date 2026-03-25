import React from 'react';

/**
 * Button — Theme-aware button component.
 * Uses CSS custom properties for dark mode support.
 */
export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "text-white shadow-sm",
    secondary: "shadow-sm",
    outline: "shadow-sm",
    danger: "text-white shadow-sm",
    ghost: "",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  /* Inline style maps using CSS vars for theme awareness */
  const variantStyles = {
    primary: {
      background: "var(--accent-gradient)",
      color: "#fff",
    },
    secondary: {
      background: "var(--bg-elevated)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
    },
    outline: {
      background: "var(--bg-surface)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "var(--error)",
      color: "#fff",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-secondary)",
    },
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      style={variantStyles[variant]}
      disabled={disabled || isLoading}
      onMouseEnter={(e) => {
        if (variant === 'outline' || variant === 'ghost') {
          e.currentTarget.style.background = "var(--hover-overlay-medium)";
        }
        if (variant === 'secondary') {
          e.currentTarget.style.background = "var(--bg-inset)";
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'outline' || variant === 'ghost') {
          e.currentTarget.style.background = variantStyles[variant].background;
        }
        if (variant === 'secondary') {
          e.currentTarget.style.background = "var(--bg-elevated)";
        }
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </>
      ) : children}
    </button>
  );
};