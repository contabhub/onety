'use client';

import * as React from 'react';


const Drawer = ({
  shouldScaleBackground = true,
  ...props
}) => (
  <div {...props} />
);
Drawer.displayName = 'Drawer';

const DrawerTrigger = ({ children, ...props }) => (
  <button {...props}>{children}</button>
);

const DrawerPortal = ({ children }) => children;

const DrawerClose = ({ children, ...props }) => (
  <button {...props}>{children}</button>
);

const DrawerOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`fixed inset-0 z-50 bg-black/80 ${className || ''}`}
    {...props}
  />
));
DrawerOverlay.displayName = 'DrawerOverlay';

const DrawerContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <div
      ref={ref}
      className={`fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background ${className || ''}`}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </div>
  </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({
  className,
  ...props
}) => (
  <div
    className={`grid gap-1.5 p-4 text-center sm:text-left ${className || ''}`}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({
  className,
  ...props
}) => (
  <div
    className={`mt-auto flex flex-col gap-2 p-4 ${className || ''}`}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}
    {...props}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-muted-foreground ${className || ''}`}
    {...props}
  />
));
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
