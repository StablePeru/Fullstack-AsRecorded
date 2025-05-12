export function Button({
    variant = "primary",
    className = "",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "success" | "danger";
  }) {
    const base =
      "rounded px-4 py-2 font-semibold text-white transition disabled:opacity-50";
    const colors: Record<string, string> = {
      primary: "bg-blue-600 hover:bg-blue-700",
      success: "bg-emerald-600 hover:bg-emerald-700",
      danger:  "bg-red-600 hover:bg-red-700",
    };
    return (
      <button className={`${base} ${colors[variant]} ${className}`} {...props} />
    );
  }
  