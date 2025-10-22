'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import styles from '../../styles/financeiro/label.module.css';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(styles.labelRoot, className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
