'use client';

import * as React from 'react';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const ToggleGroup = React.forwardRef(({ className, value, onValueChange, type = 'single', ...props }, ref) => {
  const [selectedValue, setSelectedValue] = React.useState(value);

  const handleValueChange = (newValue) => {
    setSelectedValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    >
      {React.Children.map(props.children, (child) => {
        if (React.isValidElement(child) && child.type === ToggleGroupItem) {
          return React.cloneElement(child, {
            isSelected: selectedValue === child.props.value,
            onSelect: () => handleValueChange(child.props.value),
          });
        }
        return child;
      })}
    </div>
  );
});
ToggleGroup.displayName = 'ToggleGroup';

const ToggleGroupItem = React.forwardRef(({ className, value, isSelected, onSelect, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isSelected ? 'bg-background text-foreground shadow-sm' : '',
        className
      )}
      onClick={onSelect}
      data-state={isSelected ? 'on' : 'off'}
      {...props}
    />
  );
});
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };

