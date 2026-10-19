import type { ReactNode } from "react";
import { CardContent, Card, CardHeader, CardTitle } from "@/components/ui/card";

type ReaderStatusScreenProps = {
  message: string;
  children?: ReactNode;
};

export function ReaderStatusScreen({ message, children }: ReaderStatusScreenProps) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <img
              src="/icons/app-logo.png"
              alt="KJV Only app icon"
              className="h-16 w-auto object-contain"
            />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">KJV Only</CardTitle>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          </div>
        </CardHeader>
        {children ? <CardContent className="flex flex-wrap gap-2">{children}</CardContent> : null}
      </Card>
    </main>
  );
}
