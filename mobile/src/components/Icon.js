import React from 'react';
import HomeOutline from '../assets/icons/home-outline.svg';
import HomeFilled from '../assets/icons/home-filled.svg';
import PlayOutline from '../assets/icons/play-outline.svg';
import PlayFilled from '../assets/icons/play-filled.svg';
import CrewOutline from '../assets/icons/crew-outline.svg';
import CrewFilled from '../assets/icons/crew-filled.svg';
import ProfileOutline from '../assets/icons/profile-outline.svg';
import ProfileFilled from '../assets/icons/profile-filled.svg';

const ICONS = {
  home: { outline: HomeOutline, filled: HomeFilled },
  play: { outline: PlayOutline, filled: PlayFilled },
  crew: { outline: CrewOutline, filled: CrewFilled },
  profile: { outline: ProfileOutline, filled: ProfileFilled },
};

export function Icon({ name, active = false, size = 22, color }) {
  const iconEntry = ICONS[name];
  if (!iconEntry) return null;
  const Component = active ? iconEntry.filled : iconEntry.outline;
  return <Component width={size} height={size} color={color} />;
}
