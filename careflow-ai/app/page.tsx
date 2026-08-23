import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import WorkflowVisualization from '@/components/WorkflowVisualization';
import Features from '@/components/Features';
import UserWorkflows from '@/components/UserWorkflows';
import VoiceIntake from '@/components/VoiceIntake';
import HowItWorks from '@/components/HowItWorks';
import TrustPrivacy from '@/components/TrustPrivacy';
import FinalCTA from '@/components/FinalCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <WorkflowVisualization />
        <Features />
        <UserWorkflows />
        <VoiceIntake />
        <HowItWorks />
        <TrustPrivacy />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
