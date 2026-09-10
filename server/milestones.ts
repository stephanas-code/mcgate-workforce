import { queryOne, queryAll, execute } from './db.ts';

export const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Completion factor by task workflow status
export const STATUS_FACTORS: Record<string, number> = {
  COMPLETED: 1.0,
  IN_REVIEW: 0.8,
  IN_PROGRESS: 0.4,
  BLOCKED: 0.1,
  TODO: 0.0,
  CANCELLED: 0.0,
};

export interface MilestoneMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  inReviewTasks: number;
  todoTasks: number;
  progressPercent: number;
  rawProgressPercent: number;
  newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED';
  urgentCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hasBlockedTasks: boolean;
}

/**
 * Calculates priority-weighted progress and automatic workflow stage for a milestone.
 * When tasks are created, edited, removed, or priorities change, this accurately
 * re-evaluates the milestone's stage and completion metrics.
 */
export async function calculateMilestoneMetrics(assignmentId: number): Promise<MilestoneMetrics> {
  const tasks = await queryAll<{
    id: number;
    priority: string;
    status: string;
  }>('SELECT id, priority, status FROM tasks WHERE assignment_id = ?', [assignmentId]);

  if (tasks.length === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      inReviewTasks: 0,
      todoTasks: 0,
      progressPercent: 0,
      rawProgressPercent: 0,
      newStatus: 'NOT_STARTED',
      urgentCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      hasBlockedTasks: false,
    };
  }

  const totalTasks = tasks.length;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;
  let inReviewTasks = 0;
  let todoTasks = 0;
  let urgentCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const t of tasks) {
    const weight = PRIORITY_WEIGHTS[t.priority] || 2;
    const factor = STATUS_FACTORS[t.status] ?? 0.0;

    // Track status counts
    if (t.status === 'COMPLETED') completedTasks++;
    else if (t.status === 'IN_REVIEW') inReviewTasks++;
    else if (t.status === 'IN_PROGRESS') inProgressTasks++;
    else if (t.status === 'BLOCKED') blockedTasks++;
    else if (t.status === 'TODO') todoTasks++;

    // Track priority counts
    if (t.priority === 'URGENT') urgentCount++;
    else if (t.priority === 'HIGH') highCount++;
    else if (t.priority === 'MEDIUM') mediumCount++;
    else if (t.priority === 'LOW') lowCount++;

    if (t.status !== 'CANCELLED') {
      totalWeight += weight;
      earnedWeight += weight * factor;
    }
  }

  const progressPercent = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;
  const rawProgressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Determine stage / status automatically:
  // 1. If all valid tasks are COMPLETED -> COMPLETED
  // 2. Else if all active incomplete tasks are IN_REVIEW -> IN_REVIEW
  // 3. Else if any task is IN_PROGRESS, COMPLETED, or BLOCKED -> IN_PROGRESS
  // 4. Otherwise -> NOT_STARTED
  let newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' = 'NOT_STARTED';

  const nonCancelledCount = totalTasks - tasks.filter(t => t.status === 'CANCELLED').length;
  if (nonCancelledCount > 0 && completedTasks === nonCancelledCount) {
    newStatus = 'COMPLETED';
  } else if (nonCancelledCount > 0 && (completedTasks + inReviewTasks === nonCancelledCount) && inReviewTasks > 0) {
    newStatus = 'IN_REVIEW';
  } else if (inProgressTasks > 0 || completedTasks > 0 || inReviewTasks > 0 || blockedTasks > 0) {
    newStatus = 'IN_PROGRESS';
  } else {
    newStatus = 'NOT_STARTED';
  }

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    inReviewTasks,
    todoTasks,
    progressPercent,
    rawProgressPercent,
    newStatus,
    urgentCount,
    highCount,
    mediumCount,
    lowCount,
    hasBlockedTasks: blockedTasks > 0,
  };
}

/**
 * Automatically updates milestone stage/status and timestamps in the database,
 * and updates parent project updated_at.
 */
export async function syncMilestoneStageAndProgress(assignmentId: number): Promise<MilestoneMetrics> {
  const metrics = await calculateMilestoneMetrics(assignmentId);
  const now = new Date().toISOString();

  await execute(
    'UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?',
    [metrics.newStatus, now, assignmentId]
  );

  // Also touch parent project
  const assignment = await queryOne<{ project_id: number }>('SELECT project_id FROM assignments WHERE id = ?', [assignmentId]);
  if (assignment?.project_id) {
    await execute('UPDATE projects SET updated_at = ? WHERE id = ?', [now, assignment.project_id]);
  }

  return metrics;
}
