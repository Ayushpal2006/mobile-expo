/**
 * Apka Bill Mobile POS - Centralized Responsive Breakpoint & Layout System
 *
 * Provides deterministic, real-time responsive adaptation for:
 * 1. Android Phones (Compact: < 600px)
 * 2. Small Tablets & Android POS Terminals (Medium: 600px - 899px, e.g. Sunmi, PAX, iMin)
 * 3. Large Tablets & Wider Displays (Expanded: >= 900px)
 *
 * Exposes layout flags, column counts, padding scales, and grid helpers.
 */

import { useWindowDimensions } from 'react-native';

export type BreakpointCategory = 'compact' | 'medium' | 'expanded';

export interface ResponsiveLayout {
  // Screen Dimensions
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;

  // Breakpoint Categories
  breakpoint: BreakpointCategory;
  isCompact: boolean;   // Phones (< 600px)
  isMedium: boolean;    // Small tablets / POS terminals (600px - 899px)
  isExpanded: boolean;  // Large tablets / Wide displays (>= 900px)

  // Layout Properties
  columns: number;           // Recommended grid columns (1, 2, or 3-4)
  kpiColumns: number;        // Metric card columns (2 for compact, 3 for medium, 6 for expanded)
  containerPadding: number;  // Screen edge padding (12, 16, or 24)
  gutter: number;            // Space between cards (8, 12, or 16)
  contentMaxWidth?: number;  // Maximum content width constraint

  // Navigation Pattern
  useSideRail: boolean;      // True on expanded landscape screens for sidebar layout
}

export const BREAKPOINTS = {
  compactMax: 599,
  mediumMin: 600,
  mediumMax: 899,
  expandedMin: 900,
};

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  const isPortrait = height >= width;
  const isLandscape = !isPortrait;

  let breakpoint: BreakpointCategory = 'compact';
  let columns = 1;
  let kpiColumns = 2;
  let containerPadding = 12;
  let gutter = 8;
  let useSideRail = false;

  if (width >= BREAKPOINTS.expandedMin) {
    breakpoint = 'expanded';
    columns = isLandscape ? 3 : 2;
    kpiColumns = isLandscape ? 6 : 3;
    containerPadding = 20;
    gutter = 14;
    useSideRail = isLandscape;
  } else if (width >= BREAKPOINTS.mediumMin) {
    breakpoint = 'medium';
    columns = 2;
    kpiColumns = 3;
    containerPadding = 16;
    gutter = 10;
    useSideRail = false;
  } else {
    breakpoint = 'compact';
    columns = 1;
    kpiColumns = 2;
    containerPadding = 12;
    gutter = 8;
    useSideRail = false;
  }

  return {
    width,
    height,
    isPortrait,
    isLandscape,
    breakpoint,
    isCompact: breakpoint === 'compact',
    isMedium: breakpoint === 'medium',
    isExpanded: breakpoint === 'expanded',
    columns,
    kpiColumns,
    containerPadding,
    gutter,
    contentMaxWidth: breakpoint === 'expanded' ? 1280 : undefined,
    useSideRail,
  };
}

export default useResponsive;
