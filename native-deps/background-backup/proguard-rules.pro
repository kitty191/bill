# Room 2.6.1 constructs WorkManager's generated database with reflection.
# Preserve the no-argument constructor in optimized Release builds as well.
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}

# The headless task service resolves this generated class and its static method
# by name, without first creating React's UI host.
-keep class expo.modules.ExpoModulesPackageList {
    public static java.util.List getPackageList();
}
