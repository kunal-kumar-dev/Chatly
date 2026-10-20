import { prisma } from '@chatly/database';
import { PERMISSIONS, SYSTEM_ROLES, PERMISSION_GROUPS } from '@chatly/authorization';
import * as argon2 from 'argon2';

async function main() {
  console.log('🌱 Seeding database...');

  // Create permissions
  console.log('Creating permissions...');
  const permissionData = Object.entries(PERMISSIONS).map(([key, value]) => ({
    name: value,
    resource: value.split('.')[0],
    action: value.split('.')[1],
    description: `${value.split('.')[1]} ${value.split('.')[0]}`,
  }));

  for (const perm of permissionData) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // Create system roles
  console.log('Creating roles...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.SUPER_ADMIN },
    update: {},
    create: {
      name: SYSTEM_ROLES.SUPER_ADMIN,
      description: 'Full system access',
      isSystem: true,
      isCustom: false,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.ADMIN },
    update: {},
    create: {
      name: SYSTEM_ROLES.ADMIN,
      description: 'Administrator access',
      isSystem: true,
      isCustom: false,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.MANAGER },
    update: {},
    create: {
      name: SYSTEM_ROLES.MANAGER,
      description: 'Team manager access',
      isSystem: true,
      isCustom: false,
    },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.MEMBER },
    update: {},
    create: {
      name: SYSTEM_ROLES.MEMBER,
      description: 'Standard member access',
      isSystem: true,
      isCustom: false,
    },
  });

  const guestRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.GUEST },
    update: {},
    create: {
      name: SYSTEM_ROLES.GUEST,
      description: 'Guest read-only access',
      isSystem: true,
      isCustom: false,
    },
  });

  // Assign permissions to roles
  console.log('Assigning permissions to roles...');
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map(p => [p.name, p.id]));

  // Super Admin gets all permissions
  for (const permName of PERMISSION_GROUPS.SUPER_ADMIN) {
    const permId = permMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permId } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permId },
      });
    }
  }

  // Admin
  for (const permName of PERMISSION_GROUPS.ADMIN) {
    const permId = permMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permId } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permId },
      });
    }
  }

  // Manager
  for (const permName of PERMISSION_GROUPS.MANAGER) {
    const permId = permMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permId } },
        update: {},
        create: { roleId: managerRole.id, permissionId: permId },
      });
    }
  }

  // Member
  for (const permName of PERMISSION_GROUPS.MEMBER) {
    const permId = permMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: memberRole.id, permissionId: permId } },
        update: {},
        create: { roleId: memberRole.id, permissionId: permId },
      });
    }
  }

  // Guest
  for (const permName of PERMISSION_GROUPS.GUEST) {
    const permId = permMap.get(permName);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: guestRole.id, permissionId: permId } },
        update: {},
        create: { roleId: guestRole.id, permissionId: permId },
      });
    }
  }

  // Create demo workspace
  console.log('Creating demo workspace...');
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo',
    },
  });

  await prisma.workspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      allowGuestReadOnly: true,
      showReadReceipts: true,
      maxFileSizeMb: 50,
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
      enableVirusScan: false,
    },
  });

  // Create demo users
  console.log('Creating demo users...');
  const passwordHash = await argon2.hash('password123');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@chatly.local' },
    update: {},
    create: {
      email: 'superadmin@chatly.local',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      displayName: 'Super Admin',
      isActive: true,
      isEmailVerified: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@chatly.local' },
    update: {},
    create: {
      email: 'admin@chatly.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin User',
      isActive: true,
      isEmailVerified: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@chatly.local' },
    update: {},
    create: {
      email: 'manager@chatly.local',
      passwordHash,
      firstName: 'Manager',
      lastName: 'User',
      displayName: 'Manager User',
      isActive: true,
      isEmailVerified: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@chatly.local' },
    update: {},
    create: {
      email: 'member@chatly.local',
      passwordHash,
      firstName: 'Member',
      lastName: 'User',
      displayName: 'Member User',
      isActive: true,
      isEmailVerified: true,
    },
  });

  const guest = await prisma.user.upsert({
    where: { email: 'guest@chatly.local' },
    update: {},
    create: {
      email: 'guest@chatly.local',
      passwordHash,
      firstName: 'Guest',
      lastName: 'User',
      displayName: 'Guest User',
      isActive: true,
      isEmailVerified: true,
    },
  });

  // Add users to workspace
  for (const user of [superAdmin, admin, manager, member, guest]) {
    await prisma.userWorkspace.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: {},
      create: { userId: user.id, workspaceId: workspace.id },
    });
  }

  // Assign roles. The schema does not yet have a composite unique key for
  // this relationship, so check first to keep the development seed repeatable.
  const roleAssignments = [
    [superAdmin, superAdminRole],
    [admin, adminRole],
    [manager, managerRole],
    [member, memberRole],
    [guest, guestRole],
  ];

  for (const [user, role] of roleAssignments) {
    const assignment = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
        scopeType: 'workspace',
        scopeId: workspace.id,
      },
    });

    if (!assignment) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          scopeType: 'workspace',
          scopeId: workspace.id,
        },
      });
    }
  }

  const defaultChannels = [
    { name: 'general', description: 'Company-wide announcements and conversation' },
    { name: 'product', description: 'Product discussion and feedback' },
    { name: 'engineering', description: 'Engineering updates and collaboration' },
    { name: 'random', description: 'A place for everything else' },
  ];

  for (const channel of defaultChannels) {
    const existingChannel = await prisma.channel.findFirst({
      where: { workspaceId: workspace.id, name: channel.name },
    });
    if (!existingChannel) {
      await prisma.channel.create({
        data: {
          ...channel,
          workspaceId: workspace.id,
          type: 'public',
          createdById: superAdmin.id,
        },
      });
    }
  }

  console.log('✅ Seeding complete!');
  console.log('\nDemo users (password: password123):');
  console.log('  Super Admin: superadmin@chatly.local');
  console.log('  Admin: admin@chatly.local');
  console.log('  Manager: manager@chatly.local');
  console.log('  Member: member@chatly.local');
  console.log('  Guest: guest@chatly.local');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
