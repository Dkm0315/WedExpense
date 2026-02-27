import React from 'react';
import { motion } from 'framer-motion';
import { BsCalendar3, BsReceipt } from 'react-icons/bs';
import BudgetBar from './BudgetBar';
import { formatDate } from '../utils/format';

interface EventData {
  ROWID: string;
  event_name: string;
  event_date: string;
  event_budget: number;
  venue?: string;
  status?: string;
}

interface EventCardProps {
  event: EventData;
  spent: number;
  expenseCount: number;
  onClick?: () => void;
}

const EMOJI_MAP: Record<string, string> = {
  Mehendi: '\uD83C\uDFA8',
  Haldi: '\uD83D\uDC9B',
  Sangeet: '\uD83C\uDFB6',
  Wedding: '\uD83D\uDC92',
  Reception: '\uD83C\uDF89',
};

function getEventEmoji(name: string): string {
  for (const key of Object.keys(EMOJI_MAP)) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return EMOJI_MAP[key];
    }
  }
  return '\u2728';
}

const EventCard: React.FC<EventCardProps> = ({ event, spent, expenseCount, onClick }) => {
  const emoji = getEventEmoji(event.event_name);

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 cursor-pointer hover:border-primary-400/30 hover:bg-white/[0.07] transition-colors group"
    >
      {/* Top row: emoji + name + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-primary-300 transition-colors">
              {event.event_name}
            </h3>
            {event.venue && (
              <p className="text-sm text-white/50">{event.venue}</p>
            )}
          </div>
        </div>

        {event.status && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              event.status === 'Completed'
                ? 'bg-green-500/20 text-green-400'
                : event.status === 'Cancelled'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-primary-500/20 text-primary-300'
            }`}
          >
            {event.status}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm text-white/50 mb-4">
        <BsCalendar3 className="text-xs" />
        <span>{formatDate(event.event_date)}</span>
      </div>

      {/* Budget bar */}
      <BudgetBar spent={spent} budget={event.event_budget} />

      {/* Footer: expense count */}
      <div className="flex items-center gap-1.5 mt-4 text-sm text-white/40">
        <BsReceipt className="text-xs" />
        <span>
          {expenseCount} expense{expenseCount !== 1 ? 's' : ''}
        </span>
      </div>
    </motion.div>
  );
};

export default EventCard;
