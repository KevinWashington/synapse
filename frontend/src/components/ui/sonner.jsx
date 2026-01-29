import { Toaster as Sonner } from "sonner";

function Toaster({ ...props }) {
    return (
        <Sonner
            className="toaster group"
            position="top-right"
            richColors
            expand={false}
            duration={4000}
            closeButton
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
                    description: "group-[.toast]:text-muted-foreground",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                    success:
                        "group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 group-[.toaster]:border-green-200 dark:group-[.toaster]:bg-green-900/20 dark:group-[.toaster]:text-green-100 dark:group-[.toaster]:border-green-800",
                    error:
                        "group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-200 dark:group-[.toaster]:bg-red-900/20 dark:group-[.toaster]:text-red-100 dark:group-[.toaster]:border-red-800",
                    warning:
                        "group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-900 group-[.toaster]:border-amber-200 dark:group-[.toaster]:bg-amber-900/20 dark:group-[.toaster]:text-amber-100 dark:group-[.toaster]:border-amber-800",
                    info: "group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 group-[.toaster]:border-blue-200 dark:group-[.toaster]:bg-blue-900/20 dark:group-[.toaster]:text-blue-100 dark:group-[.toaster]:border-blue-800",
                },
            }}
            {...props}
        />
    );
}

export { Toaster };
