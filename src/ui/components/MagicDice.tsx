import { MagneticButton } from "@/components/motion/button";
import { DiceActiveIcon } from "@/ui/icons";

interface MagicDiceProps {
  onClick?: () => void;
}

export function MagicDice({ onClick }: MagicDiceProps) {
  return (
    <div className="flex items-center justify-center">
      <MagneticButton
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Magic Dice"
        onClick={onClick}
        className="size-16 rounded-full bg-card text-primary"
      >
        <DiceActiveIcon size={40} />
      </MagneticButton>
    </div>
  );
}
