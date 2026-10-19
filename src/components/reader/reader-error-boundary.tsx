import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Props = { children: ReactNode; label: string; resetKey?: string };
export class ReaderErrorBoundary extends Component<Props, { failed: boolean; resetKey?: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: Props, state: { resetKey?: string }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card role="alert" className="m-2 w-auto">
        <CardHeader>
        <CardTitle>{this.props.label} hit a problem</CardTitle>
        <CardDescription>The rest of your workspace is still available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
}
