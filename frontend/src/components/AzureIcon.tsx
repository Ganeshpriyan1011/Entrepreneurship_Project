import React from 'react';

interface AzureIconProps {
  size?: number;
  className?: string;
}

const AzureIcon: React.FC<AzureIconProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="azureGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0078d4" />
          <stop offset="50%" stopColor="#00bcf2" />
          <stop offset="100%" stopColor="#40e0d0" />
        </linearGradient>
        <linearGradient id="azureGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#005a9e" />
          <stop offset="100%" stopColor="#0078d4" />
        </linearGradient>
      </defs>
      
      {/* Main Azure logo shape */}
      <path
        d="M48 8L20 32L8 64L32 88L64 88L88 64L76 32L48 8Z"
        fill="url(#azureGradient)"
        opacity="0.9"
      />
      
      {/* Inner geometric pattern */}
      <path
        d="M48 16L28 36L20 56L36 72L60 72L76 56L68 36L48 16Z"
        fill="url(#azureGradient2)"
        opacity="0.8"
      />
      
      {/* Central diamond */}
      <path
        d="M48 24L36 40L32 48L36 56L48 72L60 56L64 48L60 40L48 24Z"
        fill="#ffffff"
        opacity="0.9"
      />
      
      {/* Inner accent */}
      <circle
        cx="48"
        cy="48"
        r="8"
        fill="url(#azureGradient)"
        opacity="0.7"
      />
      
      {/* Highlight effect */}
      <path
        d="M48 8L76 32L68 36L48 16L28 36L20 32L48 8Z"
        fill="#ffffff"
        opacity="0.3"
      />
    </svg>
  );
};

export default AzureIcon;