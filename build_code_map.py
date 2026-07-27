import os
import ast
import json

def parse_imports(file_path):
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read(), filename=file_path)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
    except Exception as e:
        print(f"Warning parsing {file_path}: {e}")
    return sorted(list(set(imports)))

def build_codebase_map(root_dir="."):
    code_map = {}
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude hidden dirs and git/venv
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in ('venv', '__pycache__', 'build', 'dist')]
        for filename in filenames:
            if filename.endswith('.py'):
                full_path = os.path.relpath(os.path.join(dirpath, filename), root_dir)
                rel_path = full_path.replace('\\', '/')
                imports = parse_imports(os.path.join(root_dir, full_path))
                code_map[rel_path] = {
                    "imports": imports,
                    "imported_by": []
                }
    
    # Calculate imported_by references
    for file_path, data in code_map.items():
        module_name = os.path.splitext(file_path.replace('/', '.'))[0]
        for other_file, other_data in code_map.items():
            if file_path != other_file:
                for imp in other_data["imports"]:
                    if imp in module_name or module_name.endswith(imp):
                        data["imported_by"].append(other_file)
        data["imported_by"] = sorted(list(set(data["imported_by"])))

    with open(os.path.join(root_dir, "codebase_map.json"), 'w', encoding='utf-8') as f:
        json.dump(code_map, f, indent=2)
    
    print(f"Successfully generated codebase_map.json with {len(code_map)} Python files mapped.")

if __name__ == "__main__":
    build_codebase_map(".")
