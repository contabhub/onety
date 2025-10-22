import * as React from 'react';
import styles from '../../styles/financeiro/input.module.css';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(styles.input, className)}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };