"use client";

import * as React from "react";
import { Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export const REGEXP_ONLY_DIGITS = "^\\d+$";
export const REGEXP_ONLY_CHARS = "^[a-zA-Z]+$";
export const REGEXP_ONLY_DIGITS_AND_CHARS = "^[a-zA-Z0-9]+$";

export interface OTPSlotData {
  char: string | null;
  hasFakeCaret: boolean;
  isActive: boolean;
}

export interface OTPInputContextValue {
  slots: OTPSlotData[];
  isFocused: boolean;
  isDisabled: boolean;
  isInvalid: boolean;
}

export const OTPInputContext = React.createContext<OTPInputContextValue>({
  slots: [],
  isFocused: false,
  isDisabled: false,
  isInvalid: false,
});

export interface InputOTPProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "defaultValue"
> {
  value?: string;
  defaultValue?: string;
  onChange?: (newValue: string) => void;
  onComplete?: (completedValue: string) => void;
  maxLength?: number;
  pattern?: string;
  containerClassName?: string;
  children?: React.ReactNode;
}

function InputOTP({
  className,
  containerClassName,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onComplete,
  maxLength = 6,
  pattern = REGEXP_ONLY_DIGITS,
  disabled = false,
  autoFocus = false,
  children,
  "aria-invalid": ariaInvalid,
  ...props
}: InputOTPProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const [isFocused, setIsFocused] = React.useState(false);
  const [cursorIndex, setCursorIndex] = React.useState<number>(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const regex = React.useMemo(() => {
    if (!pattern) return null;
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }, [pattern]);

  const sanitizeValue = React.useCallback(
    (raw: string): string => {
      const chars = raw.split("");
      const filtered = regex
        ? chars.filter((ch) => regex.test(ch)).join("")
        : raw;
      return filtered.slice(0, maxLength);
    },
    [regex, maxLength],
  );

  React.useEffect(() => {
    if (autoFocus && !disabled) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const syncSelection = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? value.length;
    setCursorIndex(Math.min(Math.max(0, pos), maxLength - 1));
  }, [value.length, maxLength]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = sanitizeValue(e.target.value);
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
    setCursorIndex(Math.min(nextValue.length, maxLength - 1));

    if (nextValue.length === maxLength && nextValue !== value) {
      onComplete?.(nextValue);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pastedText = e.clipboardData.getData("text/plain").trim();
    const nextValue = sanitizeValue(pastedText);
    if (!nextValue) return;
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
    setCursorIndex(Math.min(nextValue.length, maxLength - 1));
    if (nextValue.length === maxLength) {
      onComplete?.(nextValue);
    }
  };

  const isInvalid = Boolean(ariaInvalid && ariaInvalid !== "false");

  const slots = React.useMemo<OTPSlotData[]>(() => {
    const activeIdx = isFocused
      ? Math.min(cursorIndex, Math.min(value.length, maxLength - 1))
      : -1;

    return Array.from({ length: maxLength }, (_, idx) => {
      const char = value[idx] ?? null;
      const isActive = isFocused && idx === activeIdx;
      const hasFakeCaret = isActive && char === null;
      return {
        char,
        isActive,
        hasFakeCaret,
      };
    });
  }, [value, maxLength, isFocused, cursorIndex]);

  const isDigitsOnly = pattern === REGEXP_ONLY_DIGITS;

  return (
    <OTPInputContext.Provider
      value={{
        slots,
        isFocused,
        isDisabled: disabled,
        isInvalid,
      }}
    >
      <div
        data-slot="input-otp"
        dir="ltr"
        data-disabled={disabled || undefined}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "relative inline-flex items-center gap-2 select-none has-disabled:opacity-50",
          disabled && "opacity-50 cursor-not-allowed",
          containerClassName,
        )}
      >
        {children}
        <input
          ref={inputRef}
          type="text"
          inputMode={isDigitsOnly ? "numeric" : "text"}
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onFocus={(e) => {
            setIsFocused(true);
            const end = value.length;
            try {
              e.currentTarget.setSelectionRange(end, end);
            } catch {
              // ignore selection range errors on non-standard inputs
            }
            setCursorIndex(Math.min(end, maxLength - 1));
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          onKeyUp={syncSelection}
          onClick={syncSelection}
          className={cn(
            "absolute inset-0 h-full w-full opacity-0 cursor-text z-20 disabled:cursor-not-allowed font-mono",
            className,
          )}
          {...props}
        />
      </div>
    </OTPInputContext.Provider>
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  const { isInvalid } = React.useContext(OTPInputContext);
  return (
    <div
      data-slot="input-otp-group"
      aria-invalid={isInvalid || undefined}
      className={cn(
        "has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive rounded-lg has-aria-invalid:ring-3 flex items-center",
        className,
      )}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};
  const isInvalid = inputOTPContext?.isInvalid ?? false;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      aria-invalid={isInvalid || undefined}
      className={cn(
        "dark:bg-input/30 bg-background border-input data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive size-10 sm:size-11 border-y border-r font-mono text-base font-bold text-foreground transition-all outline-none first:rounded-l-lg first:border-l last:rounded-r-lg data-[active=true]:ring-3 relative flex items-center justify-center data-[active=true]:z-10",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className={cn(
        "[&_svg:not([class*='size-'])]:size-4 flex items-center text-muted-foreground px-0.5",
        className,
      )}
      role="separator"
      {...props}
    >
      <Minus strokeWidth={2} />
    </div>
  );
}

export interface PodaciumOTPInputProps extends Omit<InputOTPProps, "children"> {
  invalid?: boolean;
  showSeparator?: boolean;
  slotClassName?: string;
}

export function PodaciumOTPInput({
  maxLength = 6,
  pattern = REGEXP_ONLY_DIGITS,
  invalid = false,
  showSeparator = true,
  slotClassName,
  "aria-label": ariaLabel = "One-time password",
  ...props
}: PodaciumOTPInputProps) {
  const half = Math.floor(maxLength / 2);
  const shouldSplit = showSeparator && maxLength >= 4 && maxLength % 2 === 0;

  return (
    <InputOTP
      maxLength={maxLength}
      pattern={pattern}
      aria-label={ariaLabel}
      aria-invalid={invalid || props["aria-invalid"]}
      {...props}
    >
      {shouldSplit ? (
        <>
          <InputOTPGroup>
            {Array.from({ length: half }, (_, i) => (
              <InputOTPSlot key={i} index={i} className={slotClassName} />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            {Array.from({ length: maxLength - half }, (_, i) => (
              <InputOTPSlot
                key={half + i}
                index={half + i}
                className={slotClassName}
              />
            ))}
          </InputOTPGroup>
        </>
      ) : (
        <InputOTPGroup>
          {Array.from({ length: maxLength }, (_, i) => (
            <InputOTPSlot key={i} index={i} className={slotClassName} />
          ))}
        </InputOTPGroup>
      )}
    </InputOTP>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
export default PodaciumOTPInput;
