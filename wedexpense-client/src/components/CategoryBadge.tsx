import React from 'react';

interface CategoryBadgeProps {
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Venue: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  Catering: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
  Decoration: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
  Photography: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  Videography: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
  Music: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  Entertainment: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  Attire: 'bg-rose-500/20 text-rose-400 border-rose-500/20',
  Clothing: 'bg-rose-500/20 text-rose-400 border-rose-500/20',
  Jewellery: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  Jewelry: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  'Makeup & Hair': 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/20',
  Makeup: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/20',
  Flowers: 'bg-lime-500/20 text-lime-400 border-lime-500/20',
  Transport: 'bg-sky-500/20 text-sky-400 border-sky-500/20',
  Transportation: 'bg-sky-500/20 text-sky-400 border-sky-500/20',
  Invitations: 'bg-teal-500/20 text-teal-400 border-teal-500/20',
  Stationery: 'bg-teal-500/20 text-teal-400 border-teal-500/20',
  Gifts: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  'Pandit & Rituals': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Pandit: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
  Lighting: 'bg-violet-500/20 text-violet-400 border-violet-500/20',
  Miscellaneous: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
  Other: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
};

const DEFAULT_STYLE = 'bg-white/10 text-white/60 border-white/10';

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => {
  const colorClasses = CATEGORY_COLORS[category] || DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${colorClasses}`}
    >
      {category}
    </span>
  );
};

export default CategoryBadge;
