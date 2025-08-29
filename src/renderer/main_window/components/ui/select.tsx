import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const selectVariants = cva(
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof selectVariants> {
  placeholder?: string
  value?: string
  options: SelectOption[]
  onValueChange?: (value: string) => void
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ className, variant, placeholder, value, options, onValueChange, disabled, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedValue, setSelectedValue] = React.useState(value || "")
    
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    const currentValue = value !== undefined ? value : selectedValue
    const selectedOption = options.find(option => option.value === currentValue)

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
          document.removeEventListener("mousedown", handleClickOutside)
        }
      }
    }, [isOpen])

    const handleSelect = (optionValue: string) => {
      if (value === undefined) {
        setSelectedValue(optionValue)
      }
      onValueChange?.(optionValue)
      setIsOpen(false)
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          ref={ref}
          type="button"
          className={cn(selectVariants({ variant, className }))}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          {...props}
        >
          <span className={cn("block truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "relative flex w-full cursor-default select-none items-center px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  option.disabled && "pointer-events-none opacity-50",
                  currentValue === option.value && "bg-accent text-accent-foreground"
                )}
                disabled={option.disabled}
                onClick={() => !option.disabled && handleSelect(option.value)}
              >
                {currentValue === option.value && (
                  <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                )}
                <span className={cn("block truncate", currentValue !== option.value && "ml-6")}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select, selectVariants }