import { cn } from "@/lib/utils";
import type { UseFormRegister, UseFormSetValue, FieldErrors } from "react-hook-form";
import type { InputHTMLAttributes } from "react";

export interface FormContext {
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  errors: FieldErrors<any>;
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  form: FormContext;
  label: string;
  name: string;
  maskFn?: (value: string) => string;
  optional?: boolean;
}

export function FormInput({ form, label, name, maskFn, optional, ...props }: FormInputProps) {
  const { onChange: rhfOnChange, ...rest } = form.register(name);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground/80">
        {label}
        {optional && <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
      </label>
      <input
        {...rest}
        onChange={(e) => {
          if (maskFn) {
            const el = e.target;
            const cursorPos = el.selectionStart ?? el.value.length;
            const prevLen = el.value.length;
            const masked = maskFn(el.value);
            form.setValue(name, masked, { shouldValidate: false, shouldDirty: true });
            requestAnimationFrame(() => {
              if (el.isConnected && document.activeElement === el) {
                const diff = masked.length - prevLen;
                const newPos = Math.max(0, cursorPos + diff);
                try { el.setSelectionRange(newPos, newPos); } catch {}
              }
            });
          } else {
            rhfOnChange(e);
          }
        }}
        className={cn(
          "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
          form.errors[name] && "border-destructive focus:border-destructive focus:ring-destructive/10",
          props.readOnly && "bg-muted/60 cursor-not-allowed text-muted-foreground select-none border-border/50"
        )}
        {...props}
      />
      {form.errors[name] && (
        <span className="text-xs text-destructive font-medium">
          {(form.errors[name] as any).message}
        </span>
      )}
    </div>
  );
}
