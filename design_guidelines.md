# Design Guidelines - USA Patriotic Color Scheme

## Overview
This application uses a USA patriotic color palette (Blue, Red, and White) for a professional, identifiable look. The client portal features a clean, modern design with strong visual hierarchy.

## Color Palette

### Primary Colors
- **Primary (Blue)**: `hsl(215, 74%, 45%)` - Used for buttons, links, active states, and positive actions
- **Secondary (Red)**: `hsl(356, 72%, 48%)` - Used for destructive actions, warnings, and redeem/debit actions
- **White/Light**: Clean backgrounds for cards and content areas

### Dark Mode (Default)
- **Background**: `hsl(220, 18%, 10%)` - Deep navy blue
- **Card Background**: `hsl(218, 16%, 12%)` - Slightly elevated surface
- **Sidebar**: `hsl(218, 20%, 13%)` - Sidebar navigation background
- **Foreground**: `hsl(0, 0%, 96%)` - White text for readability
- **Muted Foreground**: `hsl(215, 12%, 65%)` - Secondary text

### Light Mode
- **Background**: `hsl(0, 0%, 100%)` - Pure white
- **Card Background**: `hsl(210, 30%, 98%)` - Very light blue tint
- **Foreground**: `hsl(220, 25%, 12%)` - Dark navy text
- **Muted Foreground**: `hsl(220, 12%, 45%)` - Secondary text

## Typography
- **Headings**: Bold, foreground color for maximum visibility
- **Body Text**: Regular weight, foreground color
- **Secondary Text**: Muted foreground for supporting information
- **Labels**: Foreground color for form labels

## Components

### Buttons
- **Primary**: Blue background with white text - for main actions
- **Secondary**: Red background with white text - for destructive/redeem actions
- **Outline**: Border with transparent background - for secondary actions

### Cards
- Use `bg-card/80` for slight transparency effect
- Border with `border-border` for subtle separation
- Rounded corners with `rounded-md`

### Badges
- Primary actions: `bg-primary/20 text-primary`
- Secondary/Warning: `bg-secondary/20 text-secondary`
- Neutral: `bg-muted/50 text-muted-foreground`

### Charts
- Active/Positive: Blue (`#2563eb`)
- Churned/Negative: Red (`#dc2626`)
- Neutral: Navy variations

## Semantic Color Usage
Always use semantic color classes instead of hardcoded colors:
- `text-foreground` instead of `text-white`
- `text-muted-foreground` instead of `text-slate-400`
- `bg-card` instead of `bg-slate-800`
- `bg-background` instead of `bg-slate-900`
- `border-border` instead of `border-slate-700`
- `text-primary` for blue accents
- `text-secondary` for red accents

## Accessibility
- Maintain minimum 4.5:1 contrast ratio for text
- Use white text on blue/red backgrounds
- Use dark text on light backgrounds
- Primary and secondary colors are distinguishable for colorblind users

## Layout
- Sidebar width: 16rem (256px)
- Content padding: 1.5rem (24px)
- Card padding: 1rem (16px)
- Consistent spacing using Tailwind spacing scale

## API Response Structure
- Consistent JSON response format across all endpoints
- Clear error messages with appropriate HTTP status codes
- Standardized success/error response schemas
- camelCase for frontend-facing properties
