'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn('switch-root', className)}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className="switch-thumb" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
