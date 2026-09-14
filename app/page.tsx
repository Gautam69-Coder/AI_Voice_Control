import { App } from '@/components/app/app';

export default function Page() {
  const agentName = process.env.AGENT_NAME?.trim() || undefined;
  return <App agentName={agentName} />;
}
