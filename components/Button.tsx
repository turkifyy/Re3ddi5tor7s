
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading,
  ...props 
}) => {
  
  // Bootstrap Button Mappings
  let bsClass = "btn d-inline-flex align-items-center justify-content-center";
  
  switch (variant) {
    case 'primary':
      bsClass += " btn-primary";
      break;
    case 'secondary':
      bsClass += " btn-outline-light";
      break;
    case 'danger':
      bsClass += " btn-danger";
      break;
    case 'ghost':
      bsClass += " btn-link text-decoration-none text-info";
      break;
  }

  if (size === 'sm') bsClass += " btn-sm";
  if (size === 'lg') bsClass += " btn-lg";

  return (
    <button 
      className={`${bsClass} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      )}
      <span>{children}</span>
    </button>
  );
};
