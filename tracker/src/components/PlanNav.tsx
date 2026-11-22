import { NavLink } from 'react-router-dom';

/** Sub-navigation for the Plan area: meal plan, mess mode, eating out, sport program, recipes. */
const LINKS: [string, string][] = [
  ['/app/plan/meals', 'Meal plan'], ['/app/plan/mess', 'Mess menu'], ['/app/plan/eating-out', 'Eating out'], ['/app/plan/sport/badminton', 'Sport program'], ['/app/plan/recipes', 'Recipes'],
];
export function PlanNav() {
  return (
    <nav className="px-chips" aria-label="Plan">
      {LINKS.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `px-pill${isActive ? ' on' : ''}`} style={{ textDecoration: 'none' }}>{label}</NavLink>)}
    </nav>
  );
}
