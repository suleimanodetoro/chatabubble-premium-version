import os

source_dir = '/Users/suleimanodetoro/Desktop/BecomingHirable/ReactNativeProjects/chata-bubble'
destination_dir = '/Users/suleimanodetoro/Desktop/BecomingHirable/ReactNativeProjects/chata-bubble/googleone'

# Folders to skip
skip_dirs = {
    'android', 'ios', 'node_modules', '.git', '.expo', '.vscode', '.idea',
    'coverage', 'dist', 'build', '__tests__', 'Pods', 'xcshareddata'
}

# File extensions or exact names to skip
skip_extensions = {'.map', '.d.ts', '.ttf', '.png', '.jpg', '.jpeg', '.webp'}
skip_files = {'.DS_Store', 'LICENSE', 'README.md', 'package-lock.json', 'project_tree.txt'}

for root, dirs, files in os.walk(source_dir):
    # Skip dirs we don't care about
    dirs[:] = [d for d in dirs if d not in skip_dirs]

    relative_path = os.path.relpath(root, source_dir)
    dest_path = os.path.join(destination_dir, relative_path)
    os.makedirs(dest_path, exist_ok=True)

    for file in files:
        file_ext = os.path.splitext(file)[1]
        if file in skip_files or file_ext in skip_extensions:
            continue

        src_file_path = os.path.join(root, file)
        dest_file_name = f"{os.path.splitext(file)[0]}.txt"
        dest_file_path = os.path.join(dest_path, dest_file_name)

        try:
            with open(src_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            with open(dest_file_path, 'w', encoding='utf-8') as f_out:
                f_out.write(content)
        except Exception as e:
            print(f"⚠️ Skipping {src_file_path}: {e}")
