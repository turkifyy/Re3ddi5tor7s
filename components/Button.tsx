
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
  
  // Materialize Button Mappings
  let matClass = "btn waves-effect waves-light";
  
  switch (variant) {
    case 'primary':
      matClass += " cyan accent-4 black-text";
      break;
    case 'secondary':
      matClass += " blue-grey darken-3 grey-text text-lighten-3";
      break;
    case 'danger':
      matClass += " red darken-3 white-text";
      break;
    case 'ghost':
      matClass = "btn-flat waves-effect waves-teal white-text";
      break;
  }

  // Size adjustments (Materialize defaults to one size, custom css for others)
  let sizeStyle = {};
  if (size === 'sm') sizeStyle = { height: '32px', lineHeight: '32px', padding: '0 12px', fontSize: '0.8rem' };
  if (size === 'lg') sizeStyle = { height: '54px', lineHeight: '54px', fontSize: '1.2rem' };

  return (
    <button 
      className={`${matClass} ${className}`}
      style={sizeStyle}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="preloader-wrapper small active" style={{width: '20px', height: '20px', verticalAlign: 'middle', marginLeft: '8px'}}>
            <div className="spinner-layer spinner-white-only">
            <div className="circle-clipper left"><div className="circle"></div></div>
            <div className="gap-patch"><div className="circle"></div></div>
            <div className="circle-clipper right"><div className="circle"></div></div>
            </div>
        </div>
      ) : null}
      <span style={{ verticalAlign: 'middle' }}>{children}</span>
    </button>
  );
};
