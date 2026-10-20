/************************************************************
 CMP2003 - Data Structures
 LAB 5 - Linked List  (linkedListType)
 ------------------------------------------------------------
 THIS IS THE ONLY FILE YOU EDIT AND SUBMIT.

 Build & run (no other files needed):
     make run
 or  g++ -Wall --std=c++17 MainProgram.cpp -o main && ./main

 The program compiles and runs from the start: unfinished
 functions just print a "not implemented" message in main().
 Check your score any time with:  make grade

 YOUR TASKS  (edit ONLY the 8 functions marked TODO below)
   Task 1 - insertFirst / insertLast         15 pts
   Task 2 - insertAt(int index, item)        15 pts
   Task 3 - removeAt(int index)              20 pts
   Task 4 - removeAll(const Type& item)      20 pts
   Task 5 - deep copy: copyList / operator=  15 pts
   Task 6 - reverse()                        15 pts

 THE RULES THE AUTOGRADER CHECKS IN EVERY TEST
   - first, last and count must always be correct:
       * empty list   -> first == last == nullptr, count == 0
       * otherwise    -> last points to the final node and
                         last->link == nullptr
   - every node you remove must be deleted (no memory leaks)
   - reverse() must NOT create or delete nodes: it only
     changes links
   - insertLast must be O(1): use `last`, don't walk the list
   - big lists (up to 1,000,000 nodes) must finish in time,
     so think about the Big-O of your solution
   - no std::vector, std::list or other STL containers
************************************************************/
#include <iostream>
#include <cassert>
#include <stdexcept>
using namespace std;

// ==========================================================
// NODE  (given)
// ==========================================================
template <class Type>
struct nodeType {
    Type info;               // the data
    nodeType<Type>* link;    // pointer to the next node (nullptr = end)
};

// ==========================================================
// CLASS
// ==========================================================
template <class Type>
class linkedListType {
public:
    // ---------- given (already working) ----------
    linkedListType();
    linkedListType(const linkedListType<Type>& otherList);   // deep copy
    ~linkedListType();

    void initializeList();
    bool isEmptyList() const;
    int  length() const;
    void print() const;
    void destroyList();
    Type front() const;
    Type back() const;
    bool search(const Type& searchItem) const;
    void deleteNode(const Type& deleteItem);

    // ---------- YOUR TASKS ----------
    void insertFirst(const Type& newItem);            // Task 1
    void insertLast(const Type& newItem);             // Task 1
    void insertAt(int index, const Type& newItem);    // Task 2
    void removeAt(int index);                         // Task 3
    int  removeAll(const Type& item);                 // Task 4
    const linkedListType<Type>& operator=(const linkedListType<Type>& otherList);   // Task 5
    void reverse();                                   // Task 6

protected:
    void copyList(const linkedListType<Type>& otherList);   // Task 5 (used by the copy constructor and operator=)

    int count;                 // number of nodes
    nodeType<Type>* first;     // pointer to the first node
    nodeType<Type>* last;      // pointer to the last node
};

// ==========================================================
// PROVIDED IMPLEMENTATIONS (already working - do not change)
// ==========================================================
template <class Type>
linkedListType<Type>::linkedListType() {
    first = nullptr;
    last = nullptr;
    count = 0;
}

template <class Type>
linkedListType<Type>::linkedListType(const linkedListType<Type>& otherList) {
    first = nullptr;
    last = nullptr;
    count = 0;
    copyList(otherList);                       // your Task 5
}

template <class Type>
linkedListType<Type>::~linkedListType() {
    destroyList();
}

template <class Type>
void linkedListType<Type>::initializeList() {
    destroyList();
}

template <class Type>
bool linkedListType<Type>::isEmptyList() const {
    return first == nullptr;
}

template <class Type>
int linkedListType<Type>::length() const {
    return count;
}

template <class Type>
void linkedListType<Type>::print() const {
    for (nodeType<Type>* cur = first; cur != nullptr; cur = cur->link)
        cout << cur->info << " ";
}

template <class Type>
void linkedListType<Type>::destroyList() {
    while (first != nullptr) {
        nodeType<Type>* temp = first;
        first = first->link;
        delete temp;
    }
    last = nullptr;
    count = 0;
}

template <class Type>
Type linkedListType<Type>::front() const {
    assert(first != nullptr);
    return first->info;
}

template <class Type>
Type linkedListType<Type>::back() const {
    assert(last != nullptr);
    return last->info;
}

template <class Type>
bool linkedListType<Type>::search(const Type& searchItem) const {
    for (nodeType<Type>* cur = first; cur != nullptr; cur = cur->link)
        if (cur->info == searchItem)
            return true;
    return false;
}

template <class Type>
void linkedListType<Type>::deleteNode(const Type& deleteItem) {
    if (first == nullptr) {
        cerr << "Cannot delete from an empty list." << endl;
        return;
    }
    if (first->info == deleteItem) {              // delete the first node
        nodeType<Type>* current = first;
        first = first->link;
        if (first == nullptr)
            last = nullptr;
        delete current;
        count--;
        return;
    }
    nodeType<Type>* trailCurrent = first;         // node before current
    nodeType<Type>* current = first->link;
    while (current != nullptr && !(current->info == deleteItem)) {
        trailCurrent = current;
        current = current->link;
    }
    if (current == nullptr) {
        cerr << "The item to be deleted is not in the list." << endl;
        return;
    }
    trailCurrent->link = current->link;
    if (current == last)
        last = trailCurrent;
    delete current;
    count--;
}

// ==========================================================
// YOUR WORK STARTS HERE
// Replace each "not implemented" line with your own code.
// Tip: draw the boxes and arrows on paper first!
// ==========================================================

// ----------------------------------------------------------
// Task 1a - insertFirst  (7 pts)
// Create a new node holding newItem and make it the FIRST node.
//   {20, 30}.insertFirst(10)  ->  {10, 20, 30}
// Inserting into an EMPTY list: the new node is also the last.
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::insertFirst(const Type& newItem) {
    nodeType<Type>* newNode = new nodeType<Type>;
    newNode->info = newItem;
    newNode->link = first;          // new node points to the old first node
    first = newNode;                // new node becomes the first node
    if (last == nullptr)            // list was empty: it is also the last node
        last = newNode;
    count++;
}

// ----------------------------------------------------------
// Task 1b - insertLast  (8 pts)
// Create a new node holding newItem and make it the LAST node.
//   {10, 20}.insertLast(30)  ->  {10, 20, 30}
// Use the `last` pointer: do NOT walk the whole list (must be
// O(1) - it is tested with 200,000 inserts).
// Inserting into an EMPTY list: the new node is also the first.
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::insertLast(const Type& newItem) {
    nodeType<Type>* newNode = new nodeType<Type>;
    newNode->info = newItem;
    newNode->link = nullptr;        // it will be the final node
    if (first == nullptr) {         // empty list: first and last are the new node
        first = newNode;
        last = newNode;
    } else {                        // attach after the current last node - O(1)
        last->link = newNode;
        last = newNode;
    }
    count++;
}

// ----------------------------------------------------------
// Task 2 - insertAt  (15 pts)
// (Tasks 2-6 and main() build their lists with insertLast:
//  finish Task 1 first!)
// Insert newItem so that it ends up at position `index`
// (0 = new first node, count = new last node).
//   {10, 20, 30}.insertAt(1, 99)  ->  {10, 99, 20, 30}
//   {10, 20, 30}.insertAt(3, 99)  ->  {10, 20, 30, 99}
// Keep first, last and count correct.
// If `index` is not valid (< 0 or > count), print an error
// message to cerr and leave the list unchanged.
// Hint: index 0 and index count are special cases - your
//       insertFirst() / insertLast() from Task 1 can help!
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::insertAt(int index, const Type& newItem) {
    if (index < 0 || index > count) {
        cerr << "insertAt: invalid index " << index << endl;
        return;
    }
    if (index == 0) {               // new first node (also covers the empty list)
        insertFirst(newItem);
        return;
    }
    if (index == count) {           // new last node (updates last)
        insertLast(newItem);
        return;
    }

    // walk to the node BEFORE position index
    nodeType<Type>* prev = first;
    for (int i = 0; i < index - 1; i++)
        prev = prev->link;

    nodeType<Type>* newNode = new nodeType<Type>;
    newNode->info = newItem;
    newNode->link = prev->link;     // new node -> old node at index
    prev->link = newNode;           // prev -> new node
    count++;
}

// ----------------------------------------------------------
// Task 3 - removeAt  (20 pts)
// Remove the node at position `index` (0 = first node) and
// delete it. Keep first, last and count correct.
// If `index` is not valid (< 0 or >= count), print an error
// message to cerr and leave the list unchanged.
//   {10, 20, 30, 40}.removeAt(1)  ->  {10, 30, 40}
// Hint: to unlink a node you need the node BEFORE it.
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::removeAt(int index) {
    if (index < 0 || index >= count) {
        cerr << "removeAt: invalid index " << index << endl;
        return;
    }

    nodeType<Type>* toDelete;
    if (index == 0) {               // remove the first node
        toDelete = first;
        first = first->link;
        if (first == nullptr)       // it was the only node
            last = nullptr;
    } else {
        // walk to the node BEFORE position index
        nodeType<Type>* prev = first;
        for (int i = 0; i < index - 1; i++)
            prev = prev->link;

        toDelete = prev->link;
        prev->link = toDelete->link;    // skip over the removed node
        if (toDelete == last)           // removed the last node
            last = prev;
    }
    delete toDelete;
    count--;
}

// ----------------------------------------------------------
// Task 4 - removeAll  (20 pts)
// Remove (and delete) EVERY node whose info == item, in ONE
// pass over the list (O(n)). Keep the order of the remaining
// nodes. Return how many nodes were removed.
//   {7, 5, 7, 7, 3, 7}.removeAll(7)  ->  {5, 3}, returns 4
// Careful: the item can be at the front, at the end, many
// times in a row, or everywhere.
// Hint: first remove matches at the front, then walk with a
//       pointer `prev` and look at prev->link. After removing,
//       do NOT move prev forward (the new next may match too).
// ----------------------------------------------------------
template <class Type>
int linkedListType<Type>::removeAll(const Type& item) {
    int removed = 0;

    // 1) remove matches at the front
    while (first != nullptr && first->info == item) {
        nodeType<Type>* temp = first;
        first = first->link;
        delete temp;
        removed++;
    }

    if (first == nullptr) {         // everything removed (or list was empty)
        last = nullptr;
        count -= removed;
        return removed;
    }

    // 2) first does not match: look at prev->link
    nodeType<Type>* prev = first;
    while (prev->link != nullptr) {
        if (prev->link->info == item) {
            nodeType<Type>* temp = prev->link;
            prev->link = temp->link;    // unlink; do NOT move prev
            delete temp;
            removed++;
        } else {
            prev = prev->link;
        }
    }

    last = prev;                    // prev is now the final node
    count -= removed;
    return removed;
}

// ----------------------------------------------------------
// Task 5a - copyList  (deep copy helper)
// This list is EMPTY when copyList is called. Append a NEW
// node for every node of otherList: same values, same order.
// Never share nodes:  first = otherList.first;  is WRONG
// (that is a shallow copy - both lists would own the same
// nodes and delete them twice).
// Keep first, last and count correct. You may use insertLast.
// The given copy constructor calls this function.
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::copyList(const linkedListType<Type>& otherList) {
    for (nodeType<Type>* cur = otherList.first; cur != nullptr; cur = cur->link)
        insertLast(cur->info);      // new node for each value, O(1) each
}

// ----------------------------------------------------------
// Task 5b - operator=  (deep copy)                Task 5: 15 pts
// After  b = a;  b holds the same values in its OWN nodes.
//   1) a = a (self-assignment) must leave the list unchanged:
//      check  this != &otherList
//   2) delete the nodes this list had before (no leak)
//   3) copy otherList (copyList can help!)
//   4) return *this, so that  c = b = a;  works
// ----------------------------------------------------------
template <class Type>
const linkedListType<Type>& linkedListType<Type>::operator=(const linkedListType<Type>& otherList) {
    if (this != &otherList) {       // avoid self-assignment
        destroyList();              // free the old nodes (sets first/last/count)
        copyList(otherList);        // build our own copy
    }
    return *this;
}

// ----------------------------------------------------------
// Task 6 - reverse  (15 pts)
// Reverse the list IN PLACE by changing the links.
// Do NOT create or delete any node, and do NOT use recursion
// (a 1,000,000-node list would overflow the stack).
//   {1, 2, 3, 4}  ->  {4, 3, 2, 1}
// Don't forget: first and last swap roles.
// Hint: three pointers prev / current / next - in each step
//       turn one arrow around.
// ----------------------------------------------------------
template <class Type>
void linkedListType<Type>::reverse() {
    nodeType<Type>* prev = nullptr;
    nodeType<Type>* current = first;
    last = first;                   // the old first node becomes the last
    while (current != nullptr) {
        nodeType<Type>* next = current->link;   // remember the rest
        current->link = prev;                   // turn the arrow around
        prev = current;
        current = next;
    }
    first = prev;                   // the old last node becomes the first
}

// ==========================================================
// YOUR WORK ENDS HERE
// ==========================================================

// ==========================================================
// EXAMPLE MAIN - try your functions here, add your own tests!
// (the autograder compiles this file without this main)
// ==========================================================
#ifndef AUTOGRADING

// prints a list in braces, e.g.  {10 20 30}  (size 3)
template <class Type>
void show(const char* label, const linkedListType<Type>& list) {
    cout << label << "{ ";
    list.print();
    cout << "}  (size " << list.length() << ")" << endl;
}

int main() {
    // ---------------- Task 1 ----------------
    cout << "=== Task 1: insertFirst / insertLast ===" << endl;
    try {
        linkedListType<int> z;
        z.insertLast(20);
        z.insertLast(30);
        z.insertFirst(10);
        show("20, 30, then 10 : ", z);        // { 10 20 30 }   (insertLast 20, 30 + insertFirst 10)
        cout << "front / back    : " << z.front() << " / " << z.back() << endl;   // 10 / 30
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    // ---------------- Task 2 ----------------
    cout << "\n=== Task 2: insertAt ===" << endl;
    try {
        linkedListType<int> a;
        for (int x : {10, 20, 30}) a.insertLast(x);
        show("before          : ", a);
        a.insertAt(1, 99);
        show("insertAt(1, 99) : ", a);        // { 10 99 20 30 }
        a.insertAt(0, 5);
        show("insertAt(0, 5)  : ", a);        // { 5 10 99 20 30 }
        a.insertAt(5, 77);
        show("insertAt(5, 77) : ", a);        // { 5 10 99 20 30 77 }
        cout << "back()          : " << a.back() << endl;   // 77
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    // ---------------- Task 3 ----------------
    cout << "\n=== Task 3: removeAt ===" << endl;
    try {
        linkedListType<int> b;
        for (int x : {10, 20, 30, 40}) b.insertLast(x);
        show("before          : ", b);
        b.removeAt(1);
        show("removeAt(1)     : ", b);        // { 10 30 40 }
        b.removeAt(2);
        show("removeAt(2)     : ", b);        // { 10 30 }  (last node removed)
        b.insertLast(99);
        show("insertLast(99)  : ", b);        // { 10 30 99 }  (works only if `last` is right)
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    // ---------------- Task 4 ----------------
    cout << "\n=== Task 4: removeAll ===" << endl;
    try {
        linkedListType<int> c;
        for (int x : {7, 5, 7, 7, 3, 7}) c.insertLast(x);
        show("before          : ", c);
        int removed = c.removeAll(7);
        show("removeAll(7)    : ", c);        // { 5 3 }
        cout << "removed         : " << removed << endl;   // 4
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    // ---------------- Task 5 ----------------
    cout << "\n=== Task 5: deep copy ===" << endl;
    try {
        linkedListType<int> original;
        for (int x : {1, 2, 3}) original.insertLast(x);
        linkedListType<int> copy1(original);           // copy constructor -> copyList
        linkedListType<int> copy2;
        copy2.insertLast(100);
        copy2 = original;                              // operator=
        copy1.insertLast(4);                           // must NOT change original
        copy2.insertFirst(0);                          // must NOT change original
        original = original;                           // self-assignment
        show("original        : ", original);           // { 1 2 3 }
        show("copy1 + 4       : ", copy1);              // { 1 2 3 4 }
        show("0 + copy2       : ", copy2);              // { 0 1 2 3 }
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    // ---------------- Task 6 ----------------
    cout << "\n=== Task 6: reverse ===" << endl;
    try {
        linkedListType<int> d;
        for (int x : {1, 2, 3, 4, 5}) d.insertLast(x);
        show("before          : ", d);
        d.reverse();
        show("reverse()       : ", d);        // { 5 4 3 2 1 }
        cout << "front / back    : " << d.front() << " / " << d.back() << endl;   // 5 / 1
    } catch (const exception& e) {
        cout << e.what() << endl;
    }

    cout << "\n=== DONE ===  (run 'make grade' to see your score)" << endl;
    return 0;
}
#endif
