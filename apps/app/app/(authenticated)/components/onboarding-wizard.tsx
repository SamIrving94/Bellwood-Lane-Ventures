'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/design-system/components/ui/dialog';
import { Progress } from '@repo/design-system/components/ui/progress';
import { BookOpenIcon, CalendarIcon, MessageSquareIcon, PenLineIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { EntryComposer } from './entry-composer';

const STORAGE_KEY = 'microjournal-onboarding-complete';

const STEPS = [
  { title: 'Welcome', icon: PenLineIcon },
  { title: 'First entry', icon: BookOpenIcon },
  { title: 'WhatsApp', icon: MessageSquareIcon },
  { title: 'Preferences', icon: CalendarIcon },
  { title: 'All set', icon: SparklesIcon },
] as const;

export const OnboardingWizard = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setOpen(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[step].icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-lg">
        {/* Progress */}
        <div className="mb-2">
          <Progress value={progress} className="h-1.5" />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </p>
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 rounded-full bg-primary/10 p-3">
                <PenLineIcon className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Welcome to Microjournal</DialogTitle>
              <DialogDescription className="text-center">
                A simple, private journaling app. Write from the web or WhatsApp — your entries stay yours.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Write anytime</strong> — from your browser or WhatsApp</li>
                <li><strong className="text-foreground">Daily prompts</strong> — get a nudge to reflect each day</li>
                <li><strong className="text-foreground">Track your mood</strong> — see patterns over time</li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>Skip setup</Button>
                <Button size="sm" onClick={() => setStep(1)}>Get started</Button>
              </div>
            </div>
          </>
        )}

        {/* Step 1: Write first entry */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Write your first entry</DialogTitle>
              <DialogDescription>
                Try it out — write anything that comes to mind.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2">
              <EntryComposer />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>Back</Button>
              <Button size="sm" onClick={() => setStep(2)}>Next</Button>
            </div>
          </>
        )}

        {/* Step 2: WhatsApp */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>Connect WhatsApp</DialogTitle>
              <DialogDescription>
                Link your phone to journal via WhatsApp messages.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                You can set this up now in <strong className="text-foreground">Settings</strong>, or skip and do it later.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
                <Button variant="outline" size="sm" onClick={() => setStep(3)}>Skip</Button>
                <Button size="sm" asChild>
                  <Link href="/settings" onClick={handleComplete}>Go to Settings</Link>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Preferences */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle>Set your preferences</DialogTitle>
              <DialogDescription>
                Choose when you get your daily prompt and your timezone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                We auto-detect your timezone. You can customise the prompt time in <strong className="text-foreground">Settings</strong>.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Back</Button>
                <Button variant="outline" size="sm" onClick={() => setStep(4)}>Skip</Button>
                <Button size="sm" asChild>
                  <Link href="/settings" onClick={handleComplete}>Go to Settings</Link>
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <SparklesIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle className="text-center">You're all set!</DialogTitle>
              <DialogDescription className="text-center">
                Start journaling. Your entries are private and always accessible.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex justify-center gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/entries" onClick={handleComplete}>View entries</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/calendar" onClick={handleComplete}>Calendar</Link>
                </Button>
                <Button size="sm" onClick={handleComplete}>
                  Start writing
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
