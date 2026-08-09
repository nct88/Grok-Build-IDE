using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace GrokBuildIDE.Setup;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var isUninstall = args.Any(a => string.Equals(a, "--uninstall", StringComparison.OrdinalIgnoreCase));
        var isSilent = args.Any(a => string.Equals(a, "--silent", StringComparison.OrdinalIgnoreCase) || string.Equals(a, "/verysilent", StringComparison.OrdinalIgnoreCase));

        var assembly = Assembly.GetExecutingAssembly();
        var version = assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == "ReleaseVersion")?.Value ?? "1.0.6";

        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var installDir = Path.Combine(localAppData, "Programs", "Grok Build IDE");
        var desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var startMenuDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");

        if (isUninstall)
        {
            PerformUninstall(installDir, desktopDir, startMenuDir, isSilent);
            return;
        }

        if (isSilent)
        {
            PerformSilentInstall(assembly, installDir, desktopDir, startMenuDir, version);
            return;
        }

        Application.Run(new SetupForm(assembly, installDir, desktopDir, startMenuDir, version));
    }

    private static void PerformSilentInstall(Assembly assembly, string installDir, string desktopDir, string startMenuDir, string version)
    {
        Directory.CreateDirectory(installDir);

        using (var stream = assembly.GetManifestResourceStream("GrokBuildIDE.Payload.zip"))
        {
            if (stream == null) return;
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            ExtractArchive(archive, installDir);
        }

        var targetExe = GetTargetExe(installDir);
        CreateShortcut(Path.Combine(desktopDir, "Grok Build IDE.lnk"), targetExe, "Grok Build IDE");
        CreateShortcut(Path.Combine(startMenuDir, "Grok Build IDE.lnk"), targetExe, "Grok Build IDE");
        RegisterUninstall(installDir, targetExe, version);
    }

    private static void PerformUninstall(string installDir, string desktopDir, string startMenuDir, bool isSilent)
    {
        if (!isSilent)
        {
            var result = MessageBox.Show(
                "Are you sure you want to uninstall Grok Build IDE?",
                "Uninstall Grok Build IDE",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );
            if (result != DialogResult.Yes) return;
        }

        var desktopShortcut = Path.Combine(desktopDir, "Grok Build IDE.lnk");
        var startMenuShortcut = Path.Combine(startMenuDir, "Grok Build IDE.lnk");

        if (File.Exists(desktopShortcut)) File.Delete(desktopShortcut);
        if (File.Exists(startMenuShortcut)) File.Delete(startMenuShortcut);

        if (Directory.Exists(installDir))
        {
            try
            {
                Directory.Delete(installDir, recursive: true);
            }
            catch { }
        }

        UnregisterUninstall();

        if (!isSilent)
        {
            MessageBox.Show("Grok Build IDE has been uninstalled.", "Uninstall Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    internal static string GetTargetExe(string installDir)
    {
        var targetExe = Path.Combine(installDir, "Grok Build IDE.exe");
        if (!File.Exists(targetExe))
        {
            var executables = Directory.GetFiles(installDir, "*.exe", SearchOption.TopDirectoryOnly);
            targetExe = executables.FirstOrDefault() ?? targetExe;
        }
        return targetExe;
    }

    internal static void ExtractArchive(ZipArchive archive, string installDir, Action<int, int, string>? progressCallback = null)
    {
        var entries = archive.Entries.Where(e => !string.IsNullOrEmpty(e.Name) || !e.FullName.EndsWith("/")).ToList();
        int total = entries.Count;

        for (int i = 0; i < total; i++)
        {
            var entry = entries[i];
            var relativePath = entry.FullName;
            var slashIndex = relativePath.IndexOf('/');
            if (slashIndex >= 0 && slashIndex < relativePath.Length - 1)
            {
                relativePath = relativePath.Substring(slashIndex + 1);
            }

            if (string.IsNullOrWhiteSpace(relativePath)) continue;

            var destinationPath = Path.Combine(installDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            var dir = Path.GetDirectoryName(destinationPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            entry.ExtractToFile(destinationPath, overwrite: true);
            progressCallback?.Invoke(i + 1, total, relativePath);
        }
    }

    internal static void CreateShortcut(string shortcutPath, string targetExePath, string description)
    {
        try
        {
            var vbsScript = $@"
Set WshShell = CreateObject(""WScript.Shell"")
Set shortcut = WshShell.CreateShortcut(""{shortcutPath.Replace(@"\", @"\\")}"")
shortcut.TargetPath = ""{targetExePath.Replace(@"\", @"\\")}""
shortcut.WorkingDirectory = ""{Path.GetDirectoryName(targetExePath)?.Replace(@"\", @"\\")}""
shortcut.Description = ""{description}""
shortcut.Save
";
            var tempVbs = Path.Combine(Path.GetTempPath(), $"create_shortcut_{Guid.NewGuid():N}.vbs");
            File.WriteAllText(tempVbs, vbsScript, Encoding.ASCII);

            var psi = new ProcessStartInfo("wscript.exe", $"\"{tempVbs}\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            };
            using var proc = Process.Start(psi);
            proc?.WaitForExit(5000);
            if (File.Exists(tempVbs)) File.Delete(tempVbs);
        }
        catch { }
    }

    internal static void RegisterUninstall(string installDir, string exePath, string version)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\GrokBuildIDE");
            if (key != null)
            {
                key.SetValue("DisplayName", "Grok Build IDE (Unofficial)");
                key.SetValue("DisplayVersion", version);
                key.SetValue("Publisher", "Local Grok");
                key.SetValue("InstallLocation", installDir);
                key.SetValue("DisplayIcon", exePath);
                key.SetValue("UninstallString", $"\"{exePath}\" --uninstall");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        catch { }
    }

    internal static void UnregisterUninstall()
    {
        try
        {
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\GrokBuildIDE", throwOnMissingSubKey: false);
        }
        catch { }
    }
}

internal class SetupForm : Form
{
    private readonly Assembly _assembly;
    private readonly string _installDir;
    private readonly string _desktopDir;
    private readonly string _startMenuDir;
    private readonly string _version;

    private readonly Label _titleLabel;
    private readonly Label _statusLabel;
    private readonly Label _fileLabel;
    private readonly ProgressBar _progressBar;
    private readonly Button _actionButton;
    private readonly CheckBox _launchCheckBox;

    public SetupForm(Assembly assembly, string installDir, string desktopDir, string startMenuDir, string version)
    {
        _assembly = assembly;
        _installDir = installDir;
        _desktopDir = desktopDir;
        _startMenuDir = startMenuDir;
        _version = version;

        Text = $"Grok Build IDE Setup (v{version})";
        Size = new Size(520, 320);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = Color.FromArgb(30, 30, 30);
        ForeColor = Color.White;

        _titleLabel = new Label
        {
            Text = $"Installing Grok Build IDE (v{version})",
            Font = new Font("Segoe UI", 14, FontStyle.Bold),
            Location = new Point(24, 20),
            AutoSize = true,
            ForeColor = Color.FromArgb(0, 168, 255)
        };

        _statusLabel = new Label
        {
            Text = "Preparing installation files...",
            Font = new Font("Segoe UI", 9.5f),
            Location = new Point(24, 65),
            Size = new Size(450, 22),
            ForeColor = Color.FromArgb(200, 200, 200)
        };

        _progressBar = new ProgressBar
        {
            Location = new Point(24, 95),
            Size = new Size(454, 28),
            Style = ProgressBarStyle.Blocks,
            Value = 0
        };

        _fileLabel = new Label
        {
            Text = "",
            Font = new Font("Segoe UI", 8.5f),
            Location = new Point(24, 130),
            Size = new Size(454, 38),
            ForeColor = Color.FromArgb(140, 140, 140)
        };

        _launchCheckBox = new CheckBox
        {
            Text = "Launch Grok Build IDE after setup finishes",
            Font = new Font("Segoe UI", 9.5f),
            Location = new Point(24, 185),
            AutoSize = true,
            Checked = true,
            Visible = false
        };

        _actionButton = new Button
        {
            Text = "Cancel",
            Font = new Font("Segoe UI", 9f),
            Location = new Point(378, 225),
            Size = new Size(100, 32),
            FlatStyle = FlatStyle.System,
            Enabled = true
        };
        _actionButton.Click += (s, e) => Close();

        Controls.Add(_titleLabel);
        Controls.Add(_statusLabel);
        Controls.Add(_progressBar);
        Controls.Add(_fileLabel);
        Controls.Add(_launchCheckBox);
        Controls.Add(_actionButton);

        Shown += async (s, e) => await StartInstallationAsync();
    }

    private async Task StartInstallationAsync()
    {
        await Task.Run(() =>
        {
            try
            {
                Directory.CreateDirectory(_installDir);

                using var stream = _assembly.GetManifestResourceStream("GrokBuildIDE.Payload.zip");
                if (stream == null)
                {
                    Invoke(new Action(() =>
                    {
                        _statusLabel.Text = "Error: Payload zip not found.";
                        _statusLabel.ForeColor = Color.Red;
                    }));
                    return;
                }

                using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
                Program.ExtractArchive(archive, _installDir, (current, total, file) =>
                {
                    int pct = (int)((double)current / total * 100);
                    Invoke(new Action(() =>
                    {
                        _progressBar.Value = pct;
                        _statusLabel.Text = $"Extracting files ({pct}%)...";
                        _fileLabel.Text = file;
                    }));
                });

                var targetExe = Program.GetTargetExe(_installDir);
                Program.CreateShortcut(Path.Combine(_desktopDir, "Grok Build IDE.lnk"), targetExe, "Grok Build IDE");
                Program.CreateShortcut(Path.Combine(_startMenuDir, "Grok Build IDE.lnk"), targetExe, "Grok Build IDE");
                Program.RegisterUninstall(_installDir, targetExe, _version);

                Invoke(new Action(() =>
                {
                    _progressBar.Value = 100;
                    _titleLabel.Text = "Installation Completed!";
                    _titleLabel.ForeColor = Color.FromArgb(46, 204, 113);
                    _statusLabel.Text = "Grok Build IDE has been installed successfully.";
                    _fileLabel.Text = $"Destination: {_installDir}";
                    _launchCheckBox.Visible = true;
                    _actionButton.Text = "Finish";
                    _actionButton.Click -= (s, e) => Close();
                    _actionButton.Click += (s, e) => FinishInstallation(targetExe);
                }));
            }
            catch (Exception ex)
            {
                Invoke(new Action(() =>
                {
                    _statusLabel.Text = $"Installation error: {ex.Message}";
                    _statusLabel.ForeColor = Color.Red;
                    _actionButton.Text = "Close";
                }));
            }
        });
    }

    private void FinishInstallation(string targetExe)
    {
        if (_launchCheckBox.Checked && File.Exists(targetExe))
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = targetExe,
                UseShellExecute = true
            });
        }
        Close();
    }
}
