import * as React from 'react';

const badgeVariants = {
  default: 'inline-flex items-center rounded-full border border-transparent bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary/80',
  secondary: 'inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-secondary/80',
  destructive: 'inline-flex items-center rounded-full border border-transparent bg-destructive text-destructive-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-destructive/80',
  outline: 'inline-flex items-center rounded-full border text-foreground px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
};

function Badge({ className = '', variant = 'default', ...props }) {
  const variantClasses = badgeVariants[variant] || badgeVariants.default;
  const combinedClasses = `${variantClasses} ${className}`.trim();
  
  return (
    <div className={combinedClasses} {...props} />
  );
}

export { Badge };
