/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;

namespace GrokWorkbench.Portable;

internal static class Program
{
	private const string PayloadResourceName = "GrokWorkbench.Payload.zip";
	private const string CacheRootEnvironmentVariable = "GROK_WORKBENCH_PORTABLE_CACHE";
	private const string CacheRootArgument = "--portable-bootstrap-cache-root=";
	private const string ExtractOnlyArgument = "--portable-bootstrap-extract-only";
	private const string WaitArgument = "--portable-bootstrap-wait";
	private const string MarkerFileName = ".payload-sha256";
	private const string EntryPointFileName = "Grok Build IDE.exe";
	private const string ProductFilePath = "resources/app/product.json";
	private const string ExtensionRegistryFilePath = "data/extensions/extensions.json";

	[STAThread]
	private static int Main(string[] args)
	{
		try {
			var build = GetBuildMetadata();
			var options = ParseOptions(args);
			var applicationDirectory = EnsurePayload(build, options.CacheRoot);
			if (options.ExtractOnly) {
				return 0;
			}

			var startInfo = new ProcessStartInfo {
				FileName = Path.Combine(applicationDirectory, EntryPointFileName),
				UseShellExecute = false,
				WorkingDirectory = Environment.CurrentDirectory
			};
			foreach (var argument in options.ForwardedArguments) {
				startInfo.ArgumentList.Add(argument);
			}

			using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Grok Build IDE could not be started.");
			if (options.WaitForExit) {
				process.WaitForExit();
				return process.ExitCode;
			}
			return 0;
		} catch (Exception error) {
			ShowError($"Grok Build IDE could not start.\n\n{error.Message}");
			return 1;
		}
	}

	private static BuildMetadata GetBuildMetadata()
	{
		var metadata = Assembly.GetExecutingAssembly()
			.GetCustomAttributes<AssemblyMetadataAttribute>()
			.ToDictionary(attribute => attribute.Key, attribute => attribute.Value ?? string.Empty, StringComparer.Ordinal);
		return new BuildMetadata(
			GetRequiredMetadata(metadata, "PayloadSha256"),
			GetRequiredMetadata(metadata, "PayloadRoot"),
			GetRequiredMetadata(metadata, "ReleaseVersion"));
	}

	private static string GetRequiredMetadata(IReadOnlyDictionary<string, string> metadata, string key)
	{
		if (!metadata.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value)) {
			throw new InvalidOperationException($"The launcher is missing required build metadata: {key}.");
		}
		return value;
	}

	private static LaunchOptions ParseOptions(IEnumerable<string> args)
	{
		var cacheRoot = Environment.GetEnvironmentVariable(CacheRootEnvironmentVariable);
		var extractOnly = false;
		var waitForExit = false;
		var forwardedArguments = new List<string>();
		foreach (var argument in args) {
			if (argument.StartsWith(CacheRootArgument, StringComparison.Ordinal)) {
				cacheRoot = argument[CacheRootArgument.Length..];
			} else if (string.Equals(argument, ExtractOnlyArgument, StringComparison.Ordinal)) {
				extractOnly = true;
			} else if (string.Equals(argument, WaitArgument, StringComparison.Ordinal)) {
				waitForExit = true;
			} else {
				forwardedArguments.Add(argument);
			}
		}

		if (string.IsNullOrWhiteSpace(cacheRoot)) {
			cacheRoot = Path.Combine(
				Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
				"Grok Build IDE Portable");
		}
		return new LaunchOptions(Path.GetFullPath(cacheRoot), extractOnly, waitForExit, forwardedArguments);
	}

	private static string EnsurePayload(BuildMetadata build, string cacheRoot)
	{
		var cacheDirectory = Path.Combine(cacheRoot, build.ReleaseVersion, build.PayloadSha256[..16]);
		var applicationDirectory = Path.Combine(cacheDirectory, build.PayloadRoot);
		if (IsValidCache(cacheDirectory, applicationDirectory, build.PayloadSha256)) {
			return applicationDirectory;
		}

		Directory.CreateDirectory(cacheRoot);
		using var mutex = new Mutex(false, $"Local\\GrokWorkbenchPortable_{build.PayloadSha256[..16]}");
		if (!mutex.WaitOne(TimeSpan.FromMinutes(5))) {
			throw new TimeoutException("Another launcher is still preparing the portable application.");
		}
		try {
			if (IsValidCache(cacheDirectory, applicationDirectory, build.PayloadSha256)) {
				return applicationDirectory;
			}
			ExtractPayload(cacheDirectory, applicationDirectory, build);
			return applicationDirectory;
		} finally {
			mutex.ReleaseMutex();
		}
	}

	private static bool IsValidCache(string cacheDirectory, string applicationDirectory, string payloadSha256)
	{
		var markerPath = Path.Combine(cacheDirectory, MarkerFileName);
		return File.Exists(Path.Combine(applicationDirectory, EntryPointFileName))
			&& File.Exists(Path.Combine(applicationDirectory, ProductFilePath))
			&& File.Exists(Path.Combine(applicationDirectory, ExtensionRegistryFilePath))
			&& File.Exists(markerPath)
			&& string.Equals(File.ReadAllText(markerPath).Trim(), payloadSha256, StringComparison.OrdinalIgnoreCase);
	}

	private static void ExtractPayload(string cacheDirectory, string applicationDirectory, BuildMetadata build)
	{
		var parentDirectory = Directory.GetParent(cacheDirectory)?.FullName
			?? throw new InvalidOperationException("The portable cache path has no parent directory.");
		Directory.CreateDirectory(parentDirectory);
		var stagingDirectory = Path.Combine(parentDirectory, $".staging-{Environment.ProcessId}-{Guid.NewGuid():N}");
		try {
			Directory.CreateDirectory(stagingDirectory);
			using var payload = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResourceName)
				?? throw new InvalidOperationException("The embedded Grok Build IDE payload is missing.");
			using var archive = new ZipArchive(payload, ZipArchiveMode.Read, leaveOpen: false);
			foreach (var entry in archive.Entries) {
				ExtractEntry(entry, stagingDirectory);
			}

			var stagedApplicationDirectory = Path.Combine(stagingDirectory, build.PayloadRoot);
			if (!File.Exists(Path.Combine(stagedApplicationDirectory, EntryPointFileName))
				|| !File.Exists(Path.Combine(stagedApplicationDirectory, ProductFilePath))
				|| !File.Exists(Path.Combine(stagedApplicationDirectory, ExtensionRegistryFilePath))) {
				throw new InvalidDataException("The embedded payload is incomplete.");
			}
			File.WriteAllText(Path.Combine(stagingDirectory, MarkerFileName), build.PayloadSha256);
			if (Directory.Exists(cacheDirectory)) {
				Directory.Delete(cacheDirectory, recursive: true);
			}
			Directory.Move(stagingDirectory, cacheDirectory);
		} finally {
			if (Directory.Exists(stagingDirectory)) {
				Directory.Delete(stagingDirectory, recursive: true);
			}
		}

		if (!IsValidCache(cacheDirectory, applicationDirectory, build.PayloadSha256)) {
			throw new InvalidDataException("The portable cache did not pass validation after extraction.");
		}
	}

	private static void ExtractEntry(ZipArchiveEntry entry, string destinationRoot)
	{
		var relativePath = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
		if (Path.IsPathRooted(relativePath)) {
			throw new InvalidDataException($"The payload contains an absolute path: {entry.FullName}");
		}
		var rootPath = Path.GetFullPath(destinationRoot) + Path.DirectorySeparatorChar;
		var destinationPath = Path.GetFullPath(Path.Combine(destinationRoot, relativePath));
		if (!destinationPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase)) {
			throw new InvalidDataException($"The payload contains an unsafe path: {entry.FullName}");
		}

		if (string.IsNullOrEmpty(entry.Name)) {
			Directory.CreateDirectory(destinationPath);
			return;
		}
		Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)
			?? throw new InvalidDataException($"The payload path has no parent: {entry.FullName}"));
		entry.ExtractToFile(destinationPath, overwrite: true);
		if (entry.LastWriteTime != default) {
			File.SetLastWriteTime(destinationPath, entry.LastWriteTime.LocalDateTime);
		}
	}

	private static void ShowError(string message)
	{
		MessageBox(IntPtr.Zero, message, "Grok Build IDE Portable", 0x00000010);
	}

	[DllImport("user32.dll", CharSet = CharSet.Unicode)]
	private static extern int MessageBox(IntPtr windowHandle, string text, string caption, uint type);

	private sealed record BuildMetadata(string PayloadSha256, string PayloadRoot, string ReleaseVersion);
	private sealed record LaunchOptions(string CacheRoot, bool ExtractOnly, bool WaitForExit, IReadOnlyList<string> ForwardedArguments);
}
