'use client';

import * as React from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import styles from '../../styles/financeiro/dropdown-menu.module.css';

// Função para combinar classes CSS
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

// Contexto para controlar o estado do dropdown
const DropdownMenuContext = React.createContext({
  isOpen: false,
  setIsOpen: () => {},
});

// Componente principal do dropdown
const DropdownMenu = ({ children, open, onOpenChange, ...props }) => {
  const [isOpen, setIsOpen] = React.useState(open || false);

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (onOpenChange) {
      onOpenChange(newIsOpen);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  // Fechar dropdown quando clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('[data-dropdown-menu]')) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen: handleToggle }}>
      <div className={styles.dropdownMenu} data-dropdown-menu {...props}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

// Trigger do dropdown
const DropdownMenuTrigger = React.forwardRef(({ className, children, asChild, ...props }, ref) => {
  const { setIsOpen } = React.useContext(DropdownMenuContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref,
      onClick: (e) => {
        setIsOpen();
        children.props.onClick?.(e);
      },
      className: cn(styles.dropdownTrigger, children.props.className),
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      className={cn(styles.dropdownTrigger, className)}
      onClick={setIsOpen}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

// Conteúdo do dropdown
const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, align = 'end', ...props }, ref) => {
  const { isOpen } = React.useContext(DropdownMenuContext);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(styles.dropdownContent, className)}
      style={{
        marginTop: `${sideOffset}px`,
        ...props.style,
      }}
      {...props}
    />
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

// Item do dropdown
const DropdownMenuItem = React.forwardRef(({ className, inset, disabled, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        styles.dropdownItem,
        inset && styles.dropdownItemInset,
        disabled && styles.dropdownItemDisabled,
        className
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

// Item com checkbox
const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, onCheckedChange, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(styles.dropdownItem, styles.dropdownCheckboxItem, className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className={styles.dropdownIndicator}>
        {checked && <Check className={styles.dropdownCheckIcon} />}
      </span>
      {children}
    </div>
  );
});
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

// Item com radio
const DropdownMenuRadioItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(styles.dropdownItem, styles.dropdownRadioItem, className)}
      {...props}
    >
      <span className={styles.dropdownIndicator}>
        <Circle className={styles.dropdownCircleIcon} />
      </span>
      {children}
    </div>
  );
});
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

// Label do dropdown
const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(styles.dropdownLabel, inset && styles.dropdownItemInset, className)}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

// Separador
const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(styles.dropdownSeparator, className)}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

// Atalho de teclado
const DropdownMenuShortcut = ({ className, ...props }) => {
  return (
    <span className={cn(styles.dropdownShortcut, className)} {...props} />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

// Componentes de grupo (simplificados)
const DropdownMenuGroup = ({ children, ...props }) => (
  <div className={styles.dropdownGroup} {...props}>
    {children}
  </div>
);

const DropdownMenuPortal = ({ children }) => children;

const DropdownMenuSub = ({ children }) => children;

const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(styles.dropdownContent, className)} {...props} />
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      styles.dropdownItem,
      styles.dropdownSubTrigger,
      inset && styles.dropdownItemInset,
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className={styles.dropdownChevron} />
  </div>
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

const DropdownMenuRadioGroup = ({ children, value, onValueChange, ...props }) => (
  <div className={styles.dropdownRadioGroup} {...props}>
    {children}
  </div>
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};