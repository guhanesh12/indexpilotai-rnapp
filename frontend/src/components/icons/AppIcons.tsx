import React from 'react';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  focused?: boolean;
  style?: any;
};

const iconColor = (section: string) => {
  const map: Record<string, string> = {
    home: '#00FFE0',
    symbols: '#FF9500',
    broker: '#7C5CFF',
    journal: '#00FF66',
    profile: '#EC4899',
    notifications: '#FFD600',
    login: '#EC4899',
    register: '#8B5CF6',
    positions: '#FFB800',
    support: '#00B4FF',
    logs: '#888888',
  };
  return map[section] || '#00BFFF';
};

export const SECTION_ICON_COLORS: Record<string, string> = {
  home: '#00FFE0',
  symbols: '#FF9500',
  broker: '#7C5CFF',
  journal: '#00FF66',
  profile: '#EC4899',
  notifications: '#FFD600',
  login: '#EC4899',
  register: '#8B5CF6',
  positions: '#FFB800',
  support: '#00B4FF',
  logs: '#888888',
};

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = '#00FFE0', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`homeGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.4" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2L2 9V21H8V15H16V21H22V9L12 2Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#homeGrad_${color})` : 'none'}
    />
    <Path
      d="M10 21V15H14V21"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SymbolsIcon: React.FC<IconProps> = ({ size = 24, color = '#FF9500', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`symGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.4" />
      </LinearGradient>
    </Defs>
    <Path
      d="M4 4H10L20 14V20H4V4Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#symGrad_${color})` : color + '20'}
    />
    <Circle cx={8} cy={12} r={2.5} stroke={color} strokeWidth={focused ? 2 : 1.5} fill="none" />
  </Svg>
);

export const BrokerIcon: React.FC<IconProps> = ({ size = 24, color = '#7C5CFF', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`brokerGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M3 21V10L12 3L21 10V21"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#brokerGrad_${color})` : color + '20'}
    />
    <Path d="M9 21V15H15V21" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8 12H10M14 12H16" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
  </Svg>
);

export const JournalIcon: React.FC<IconProps> = ({ size = 24, color = '#00FF66', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`journalGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M4 4C4 2.89543 4.89543 2 6 2H18C19.1046 2 20 2.89543 20 4V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#journalGrad_${color})` : color + '15'}
    />
    <Path d="M2 8H22" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    <Path d="M8 12H16M8 16H12" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
  </Svg>
);

export const ProfileIcon: React.FC<IconProps> = ({ size = 24, color = '#EC4899', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`profileGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.4" />
      </LinearGradient>
    </Defs>
    <Circle
      cx={12}
      cy={8}
      r={4}
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#profileGrad_${color})` : 'none'}
    />
    <Path
      d="M4 20C4 17.2386 6.23858 15 9 15H15C17.7614 15 20 17.2386 20 20"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      fill={focused ? `url(#profileGrad_${color})` : 'none'}
    />
  </Svg>
);

export const NotificationIcon: React.FC<IconProps> = ({ size = 24, color = '#FFD600', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`notifGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2C12 2 4 7 4 14V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V14C20 7 12 2 12 2Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#notifGrad_${color})` : color + '15'}
    />
    <Circle cx={12} cy={15} r={1.5} fill={color} />
    <Path d="M9 10V9C9 7.89543 9.89543 7 11 7H13C14.1046 7 15 7.89543 15 9V10" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" fill="none" />
    <Path d="M9 21H15" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    <Path d="M12 21V15" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
    {focused && <Circle cx={16} cy={10} r={0.8} fill={color} opacity={0.7} />}
    {focused && <Circle cx={8} cy={10} r={0.8} fill={color} opacity={0.7} />}
  </Svg>
);

export const LoginIcon: React.FC<IconProps> = ({ size = 24, color = '#EC4899', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`loginGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M12 2L2 7V12C2 16.5 6.5 20 12 22C17.5 20 22 16.5 22 12V7L12 2Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#loginGrad_${color})` : color + '20'}
    />
    <Path d="M8 12L11 15L16 9" stroke={color} strokeWidth={focused ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M2 8L12 13L22 8" stroke={color} strokeWidth={1} strokeDasharray="2 1" />
  </Svg>
);

export const RegisterIcon: React.FC<IconProps> = ({ size = 24, color = '#8B5CF6', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`registerGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.9" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M16 2H8C6.89543 2 6 2.89543 6 4V20C6 21.1046 6.89543 22 8 22H16C17.1046 22 18 21.1046 18 20V4C18 2.89543 17.1046 2 16 2Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#registerGrad_${color})` : color + '20'}
    />
    <Path d="M12 7V13" stroke={color} strokeWidth={focused ? 2.5 : 2} strokeLinecap="round" />
    <Path d="M9 10L12 13L15 10" stroke={color} strokeWidth={focused ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={17} r={2} fill={color} fillOpacity={0.3} />
  </Svg>
);

export const PositionsIcon: React.FC<IconProps> = ({ size = 24, color = '#FFB800', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`positionsGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Circle
      cx={12}
      cy={12}
      r={9}
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `url(#positionsGrad_${color})` : color + '20'}
    />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={focused ? 2 : 1.5} fill="none" />
    <Path d="M12 3V9M12 15V21M3 12H9M15 12H21" stroke={color} strokeWidth={focused ? 2 : 1.5} strokeLinecap="round" />
  </Svg>
);

export const SupportIcon: React.FC<IconProps> = ({ size = 24, color = '#00B4FF', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`supportGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Circle
      cx={12}
      cy={12}
      r={9}
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      fill={focused ? `url(#supportGrad_${color})` : color + '15'}
    />
    <Path d="M12 8V12" stroke={color} strokeWidth={focused ? 2.5 : 2} strokeLinecap="round" />
    <Circle cx={12} cy={16} r={0.8} fill={color} />
    <Path d="M8 10H8.009" stroke={color} strokeWidth={1} strokeLinecap="round" />
    <Path d="M16 10H15.991" stroke={color} strokeWidth={1} strokeLinecap="round" />
  </Svg>
);

export const LogsIcon: React.FC<IconProps> = ({ size = 24, color = '#888888', focused = false, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
    <Defs>
      <LinearGradient id={`logsGrad_${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Path
      d="M4 6H20C21.1046 6 22 6.89543 22 8V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V8C2 6.89543 2.89543 6 4 6Z"
      stroke={color}
      strokeWidth={focused ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Rect x={6} y={10} width={12} height={1.5} rx={0.75} fill={focused ? color : color + '40'} />
    <Rect x={6} y={13} width={8} height={1.5} rx={0.75} fill={focused ? color : color + '30'} />
    <Rect x={6} y={16} width={10} height={1.5} rx={0.75} fill={focused ? color : color + '20'} />
  </Svg>
);

export const TAB_ICONS: Record<string, React.FC<IconProps>> = {
  home: HomeIcon,
  symbols: SymbolsIcon,
  broker: BrokerIcon,
  journal: JournalIcon,
  profile: ProfileIcon,
  notifications: NotificationIcon,
  login: LoginIcon,
  register: RegisterIcon,
  'position-monitor': PositionsIcon,
  positions: PositionsIcon,
  support: SupportIcon,
  logs: LogsIcon,
};

export const getIconForSection = (section: string): React.FC<IconProps> | null => {
  return TAB_ICONS[section] || null;
};

export const getIconColor = (section: string): string => {
  return SECTION_ICON_COLORS[section] || '#00BFFF';
};
