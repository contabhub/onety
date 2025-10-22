import React from 'react';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Variantes do botão usando globals.css
const getButtonClasses = (variant = 'default', size = 'default', className = '') => {
  const baseClasses = 'btn inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variantClasses = {
    default: 'btn--primary',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'btn--secondary',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    ghost: 'hover:bg-gray-100 hover:text-gray-900',
    link: 'text-blue-600 underline-offset-4 hover:underline',
  };
  
  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };
  
  return cn(
    baseClasses,
    variantClasses[variant] || variantClasses.default,
    sizeClasses[size] || sizeClasses.default,
    className
  );
};

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? 'div' : 'button';
  return (
    <Comp
      className={getButtonClasses(variant, size, className)}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button };
